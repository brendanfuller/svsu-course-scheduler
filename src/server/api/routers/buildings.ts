import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "src/server/api/trpc";
import { GuidelineCampus, GuidelineBuilding } from "@prisma/client";
import {
  createCampusSchema,
  updateCampusSchema,
  createBuildingSchema,
  updateBuildingSchema,
} from "src/validation/buildings";
import { Prisma } from "@prisma/client";
import { prisma } from "src/server/db";
import { orderBy } from "lodash";

const TOTAL_RESULTS_PER_PAGE = 10;

const buildingWithCampus = Prisma.validator<Prisma.GuidelineBuildingArgs>()({
  include: {
    campus: true,
  },
});
export type BuildingWithCampus = Prisma.GuidelineBuildingGetPayload<
  typeof buildingWithCampus
>;

export const buildingsRouter = createTRPCRouter({
  // Campuses -------------------------------------------------------------------------------------

  //Get all campus and return the list of campus
  getAllCampus: protectedProcedure
    .input(
      z.object({
        search: z.string(),
        page: z.number().default(1),
      })
    )
    .query(async ({ ctx, input }) => {
      //Create a list of campuses from the type generated by prisma
      let campusResult: GuidelineCampus[] = [];
      let totalPages = 1;

      //Do we have a search query
      if (input.search != "") {
        campusResult = await ctx.prisma.guidelineCampus.findMany({
          //We want at least 10
          take: TOTAL_RESULTS_PER_PAGE,
          //We start at 0
          skip: (input.page - 1) * TOTAL_RESULTS_PER_PAGE,
          where: {
            name: {
              contains: input.search,
            },
          },
        });

        // Get the count of campuses within search parameters and use it to compute total page count
        const campusCount = await ctx.prisma.guidelineCampus.count({
          where: {
            name: {
              contains: input.search,
            },
          },
        });
        totalPages = Math.ceil(campusCount / TOTAL_RESULTS_PER_PAGE);
      } else {
        //If we don't have a search query don't worry about the filter
        campusResult = await ctx.prisma.guidelineCampus.findMany({
          //We want 10
          take: TOTAL_RESULTS_PER_PAGE,
          //We start at 0
          skip: (input.page - 1) * TOTAL_RESULTS_PER_PAGE,
        });

        // Get the count of campuses and use it to compute total page count
        const campusCount = await ctx.prisma.guidelineCampus.count();
        totalPages = Math.ceil(campusCount / TOTAL_RESULTS_PER_PAGE);
      }

      //Return the data
      return {
        result: campusResult,
        page: input.page,
        totalPages: totalPages,
      };
    }),

  addCampus: protectedProcedure
    .input(createCampusSchema)
    .mutation(async ({ ctx, input }) => {
      const campus = await ctx.prisma.guidelineCampus.create({
        data: {
          name: input.name,
        },
      });
      console.log(campus);
      return campus;
    }),

  deleteCampus: protectedProcedure
    .input(
      z.object({
        tuid: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      //First we need to check if we have a campus via count
      //This is done by selecting the tuid of the Campus passed
      //by the client
      const hasCampus = await ctx.prisma.guidelineCampus.count({
        where: {
          tuid: input.tuid,
        },
      });
      //Make sure to delete it if it exists
      if (hasCampus == 1) {
        await ctx.prisma.guidelineCampus.delete({
          where: {
            tuid: input.tuid,
          },
        });
        //Deletion was successful
        return true;
      }

      //Could not delete it
      return false;
    }),

  updateCampus: protectedProcedure
    .input(updateCampusSchema)
    .mutation(async ({ ctx, input }) => {
      //Find if the campus exists
      const hasCampus = await ctx.prisma.guidelineCampus.count({
        where: {
          tuid: input.tuid,
        },
      });
      //Make the campus exists
      if (hasCampus == 1) {
        await ctx.prisma.guidelineCampus.update({
          where: {
            tuid: input.tuid,
          },
          data: {
            name: input.name,
          },
        });
        return true;
      }
      //If there is no campus to update, let the frontend know
      return false;
    }),

  getCampus: protectedProcedure
    .input(
      z.object({
        tuid: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const campus = await ctx.prisma.guidelineCampus.findUnique({
        where: {
          tuid: input.tuid,
        },
      });

      return {
        campus,
      };
    }),

  // Buildings ------------------------------------------------------------------------------------

  getAllBuildings: protectedProcedure
    // Get all buildings and return the list of buildings
    .input(
      z.object({
        search: z.string(),
        page: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Create a list of buildings from the type generated by prisma
      let buildingResult: GuidelineBuilding[] = [];
      let totalPages = 0;

      // Do we have a search query
      if (input.search != "") {
        buildingResult = await ctx.prisma.guidelineBuilding.findMany({
          // We want 10
          take: TOTAL_RESULTS_PER_PAGE,
          // We start at 1
          skip: (input.page - 1) * TOTAL_RESULTS_PER_PAGE,
          where: {
            name: {
              contains: input.search,
            },
          },
        });

        // Get the count of buildings within search parameters and use it to compute total page count
        const buildingCount = await ctx.prisma.guidelineBuilding.count({
          where: {
            name: {
              contains: input.search,
            },
          },
        });
        totalPages = Math.ceil(buildingCount / TOTAL_RESULTS_PER_PAGE);
      } else {
        // If we don't have a search query don't worry about the filter
        buildingResult = await ctx.prisma.guidelineBuilding.findMany({
          // We want 10
          take: TOTAL_RESULTS_PER_PAGE,
          // We start at 1
          skip: (input.page - 1) * TOTAL_RESULTS_PER_PAGE,
        });

        // Get the count of buildings and use it to compute total page count
        const buildingCount = await ctx.prisma.guidelineBuilding.count();
        totalPages = Math.ceil(buildingCount / TOTAL_RESULTS_PER_PAGE);
      }

      // Return the data
      return {
        result: buildingResult,
        page: input.page,
        totalPages: totalPages,
      };
    }),

  getBuildingsList: protectedProcedure
    .input(
      z.object({
        search: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Create a list of buildings for a dropdown menu, sorted by campus
      const buildingsDropdown = [];

      // Do we have a search query
      if (input.search != "") {
        // Return buidlings whose name OR campus name fit within the search
        const buildingResult: BuildingWithCampus[] =
          await ctx.prisma.guidelineBuilding.findMany({
            include: {
              campus: true,
            },
            orderBy: {
              campus: {
                tuid: "asc",
              },
            },
            where: {
              OR: [
                {
                  name: {
                    contains: input.search,
                  },
                },
                {
                  prefix: {
                    contains: input.search,
                  },
                },
                {
                  campus: {
                    name: {
                      contains: input.search,
                    },
                  },
                },
              ],
            },
          });

        // Building a very specific object structure for the client
        for (const building of buildingResult) {
          buildingsDropdown.push({
            value: building.tuid,
            label: `${building.campus.name} - ${building.name} (${building.prefix})`,
          });
        }
      }

      return { result: buildingsDropdown };
    }),

  addBuilding: protectedProcedure
    .input(createBuildingSchema)
    .mutation(async ({ ctx, input }) => {
      // Add a new building
      const building = await ctx.prisma.guidelineBuilding.create({
        data: {
          campus_tuid: input.campus_tuid,
          name: input.name,
          prefix: input.prefix.toUpperCase(),
          classrooms: input.classrooms,
        },
      });

      console.log(building);

      return {
        result: building,
      };
    }),

  deleteBuilding: protectedProcedure
    .input(
      z.object({
        tuid: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First we need to check if we have a building via count.
      // This is done by selecting the tuid of the building passed
      // by the client
      const hasBuilding = await ctx.prisma.guidelineBuilding.count({
        where: {
          tuid: input.tuid,
        },
      });
      // Make sure to delete it if it exists
      if (hasBuilding == 1) {
        await ctx.prisma.guidelineBuilding.delete({
          where: {
            tuid: input.tuid,
          },
        });

        // Deletion was successful
        return true;
      }

      // Could not delete it
      return false;
    }),

  updateBuilding: protectedProcedure
    .input(updateBuildingSchema)
    .mutation(async ({ ctx, input }) => {
      // Find if the building exists
      const hasBuilding = await ctx.prisma.guidelineBuilding.count({
        where: {
          tuid: input.tuid,
        },
      });
      // Make sure the building exists
      if (hasBuilding == 1) {
        await ctx.prisma.guidelineBuilding.update({
          where: {
            tuid: input.tuid,
          },
          data: {
            name: input.name,
            prefix: input.prefix.toUpperCase(),
            campus_tuid: input.campus_tuid,
            classrooms: input.classrooms,
          },
        });
        return true;
      }
      // If there is no building to update, let the frontend know
      return false;
    }),

  getBuilding: protectedProcedure
    .input(
      z.object({
        tuid: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const building = await ctx.prisma.guidelineCampus.findUnique({
        where: {
          tuid: input.tuid,
        },
      });

      return {
        building,
      };
    }),
});
