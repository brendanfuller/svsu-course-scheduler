import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "src/server/api/trpc";
import { Department } from "@prisma/client";

/**
 * Department Router that will allow for adding, removing, deleting and querying
 * of the Departments table
 */
export const departmentRouter = createTRPCRouter({
  //add department protected procedure to add one department
  addDepartment: protectedProcedure
    .input(
      z.object({
        tuid: z.string(),
        name: z.string(),
      })
    )
    //async mutation to create a new department
    .mutation(async ({ ctx, input }) => {
      //await the creation of the new department
      await ctx.prisma.department.create({
        data: {
          tuid: input.tuid,
          name: input.name,
        },
      });
      //department has been added
      return true;
    }),

  //delete one department protected procedure to delete a single department
  deleteOneDepartment: protectedProcedure
    .input(
      z.object({
        tuid: z.string(),
        name: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      //query department and get the number of departments with the given tuid
      const hasDepartment = await ctx.prisma.department.count({
        where: {
          tuid: input.tuid,
        },
      });
      //check that there is exactly one department with the given tuid
      if (hasDepartment == 1) {
        //delete the department with the given tuid
        await ctx.prisma.department.delete({
          where: {
            tuid: input.tuid,
          },
        });
        //department has been deleted
        return true;
      }
      //could not be deleted
      return false;
    }),

  //query to get all the departments also allowing for searching
  getAllDepartments: protectedProcedure
    .input(
      z.object({
        search: z.string(),
        page: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      let departmentResult: Department[] = [];
      let totalPages = 0;
      const resultsPerPage = 10;
      //do we have a search query
      if (input.search != "") {
        departmentResult = await ctx.prisma.department.findMany({
          //we want 10
          take: resultsPerPage,
          //we start at 0
          skip: (input.page - 1) * resultsPerPage,
          //check if the search criteria meets the department name
          where: {
            OR: [
              {
                name: {
                  contains: input.search,
                },
              },
            ],
          },
        });

        /**
         * FacultyCount
         *
         * Count the total faculty members
         */
        const facultyCount = await ctx.prisma.department.count({
          where: {
            OR: [
              {
                name: {
                  contains: input.search,
                },
              },
            ],
          },
        });
        totalPages = Math.ceil(facultyCount / resultsPerPage);
      } else {
        //if we don't have a search query, don't worry about the filter
        departmentResult = await ctx.prisma.department.findMany({
          //we want 10
          take: resultsPerPage,
          //we start at 0
          skip: (input.page - 1) * resultsPerPage,
        });

        /**
         * DepartmentCount
         *
         * Count the total Departments
         */
        const departmentCount = await ctx.prisma.department.count();
        totalPages = Math.ceil(departmentCount / resultsPerPage);
      }
      //send said list to the client
      return {
        result: departmentResult,
        page: input.page,
        totalPages: totalPages,
      };
    }),
});
