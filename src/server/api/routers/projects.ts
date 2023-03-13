import { z } from "zod";

//Import Prisma (type object reference)
import { Prisma } from "@prisma/client";

//Import Prisma for indirect access that's not by the TRPC context
import { prisma } from "src/server/db";

//Import all required information for TRPC for making APIs
import { createTRPCRouter, protectedProcedure } from "src/server/api/trpc";

//Import all validation for creating revision, onboarding, etc
import {
  organizeColumnRows,
  createRevisionOnboarding,
  createRevisionSchemaTUID,
  type IProjectOrganizedColumnRowNumerical,
  type IProjectOrganizedColumnRow,
  type IProjectsExcelCourseSchema,
  excelCourseSchema,
} from "src/validation/projects";

//Import Node-XLSX for manupulating excel files (reading, and writing)
import xlsx from "node-xlsx";

/**
 * ExcelDataColumns
 * The data provided by excel. As the node-xlsx library
 * does not provide typed information we will assume the multidimensional
 * array will contain a string representation of a value or undefined if no
 * value is found. This would not be null as no value should no be represented
 * and either fail to check.
 */
type ExcelDataColumns = Array<Array<string | undefined>>;

const scheduleWithRevisions = Prisma.validator<Prisma.ScheduleArgs>()({
  include: { revisions: true },
});

/**
 * ScheduleWithRevisions
 *
 * Create a type from Prisma that contains the schedule with its revision as
 * a union type based on the payload from Prisma
 */
type ScheduleWithRevisions = Prisma.ScheduleGetPayload<
  typeof scheduleWithRevisions
>;

/**
 *
 */
interface InvertedObject {
  [key: string]: string;
}

/**
 * Projects Router
 *
 * This is the router from the projects screen.
 * - Allows projects to be view
 * - Allows projects to be created, via uploading excel and organizing columns
 * - Allows projects to be deleted*
 * - Allows projects to be uploaded with revisions like above*
 */
export const projectsRouter = createTRPCRouter({
  // ScheduleRevision -------------------------------------------------------------------------------------
  //delete schedule revision
  deleteScheduleRevision: protectedProcedure
    .input(createRevisionSchemaTUID)
    //async mutation to handle the deletion
    .mutation(async ({ ctx, input }) => {
      const hasRevision = await ctx.prisma.scheduleRevision.count({
        //check based on the client input of tuid
        where: {
          creator_tuid: ctx.session.user.id,
          tuid: input.tuid,
        },
      });
      if (hasRevision == 1) {
        await ctx.prisma.scheduleRevision.delete({
          where: {
            tuid: input.tuid,
          },
        });
        return true;
      }
      return false;
    }),

  //Get all ScheduleRevisions and display list of schedule revisions sorted by time, desecnding
  getAllScheduleRevisions: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      //Create a list of campuses from the type generated by prisma
      let scheduleResult: ScheduleWithRevisions[] = [];

      //Do we have a search query
      if (input.search != "") {
        scheduleResult = await ctx.prisma.schedule.findMany({
          //We want 10
          take: 10,
          //We start at 0
          skip: input.page * 10,
          where: {
            revisions: {
              every: { name: { contains: input.search } },
            },
          },
          include: {
            revisions: true,
          },
        });
      } else {
        //If we don't have a search query don't worry about the filter
        scheduleResult = await ctx.prisma.schedule.findMany({
          //We want 10
          take: 10,
          //We start at 0
          skip: input.page * 10,
          include: {
            revisions: {
              orderBy: {
                updatedAt: "desc",
              },
            },
          },
        });
      }

      //Return the data
      return {
        result: scheduleResult.reverse().map((s) => {
          const [main, ...revisions] = s.revisions;
          return {
            main: {
              name: main?.name,
              tuid: main?.tuid,
              updatedAt: main?.updatedAt,
            },
            revisions: revisions.map((revision) => {
              return {
                name: revision?.name,
                tuid: revision?.tuid,
                updatedAt: revision?.updatedAt,
              };
            }),
          };
        }),
        page: input.page,
      };
    }),

  verifyOrganizedColumns: protectedProcedure
    .input(organizeColumnRows)
    .mutation(async ({ ctx, input }) => {
      //Create a list of campuses from the type generated by prisma
      //input.organizeColumns.

      console.log({ input });
      const count = await ctx.prisma.scheduleRevision.count({
        where: { tuid: input.tuid },
      });

      let verifyColumns = false;
      //Check if we have some count
      if (count >= 1) {
        //Grab the revision from the database
        const revision = await ctx.prisma.scheduleRevision.findUnique({
          where: { tuid: input.tuid },
        });
        //Parse the excel file from the database
        //TODO: Make sure this doesn't error out. NOTE: This should be check in the uploadExcel api ideally.
        const results = xlsx.parse(revision?.file);
        console.log(results[0]?.data);
        //Check if we have the sheet from the file
        if (results[0] != undefined) {
          const sheet = results[0];
          const columns = sheet?.data as ExcelDataColumns;

          //console.log({ invertedNestedOrganizedColumns });

          const formattedColumns = await invertedNestedOrganizedColumns(
            columns,
            input.columns
          );

          let valid = true;
          let errors: z.ZodError;
          for (const row of formattedColumns) {
            if (row != undefined) {
              const result = await excelCourseSchema.safeParseAsync(row, {
                errorMap: excelErrorMap,
              });

              //console.log({ result, row, json: JSON.stringify(row) });
              if (result.success == false) {
                valid = false;
                errors = result.error;
                return { success: false, errors: errors.flatten() };
                break;
              }
            }
          }
          verifyColumns = valid;
        }
      }
      //Do we have a search query

      return { success: verifyColumns, errors: [] };
    }),
  createScheduleRevision: protectedProcedure
    .input(createRevisionOnboarding)
    .mutation(async ({ ctx, input }) => {
      //Create a list of campuses from the type generated by prisma
      //input.organizeColumns.

      const count = await ctx.prisma.scheduleRevision.count({
        where: { tuid: input.tuid },
      });

      //Check if we have some count
      if (count >= 1) {
        //Grab the revision from the database
        const revision = await ctx.prisma.scheduleRevision.findUnique({
          where: { tuid: input.tuid },
        });
        //Parse the excel file from the database
        //TODO: Make sure this doesn't error out. NOTE: This should be check in the uploadExcel api ideally.
        const results = xlsx.parse(revision?.file);
        console.log(results);
        //Check if we have the sheet from the file
        if (results[0] != undefined) {
          const sheet = results[0];
          const columns = sheet?.data as ExcelDataColumns;

          //console.log({ invertedNestedOrganizedColumns });

          const formattedColumns = await invertedNestedOrganizedColumns(
            columns,
            input.columns
          );

          let valid = true;
          let errors: z.ZodError;

          //Make sure every single course row is safely parsed
          for (const row of formattedColumns) {
            console.log(row);
            if (row != undefined) {
              const result = await excelCourseSchema.safeParseAsync(row);
              //console.log({ result, row, json: JSON.stringify(row) });
              if (result.success == false) {
                valid = false;
                errors = result.error;
                return { success: false, errors: errors.flatten() };
              }
            }
          }
          //TODO: Validate the input tuid for the Revision, also do we already have courses on this revision?
          //Don't want to add any extra course
          //Make sure all are valid before we actually enter them all into the database
          if (valid) {
            const [scheduele, revision, ...courses] = await prisma.$transaction(
              [
                //Also add a schedule to the page
                prisma.schedule.create({
                  data: {
                    revisions: {
                      connect: {
                        tuid: input.tuid,
                      },
                    },
                  },
                }),
                //Update the name of the revision and make them
                //no longer onboaridng
                prisma.scheduleRevision.update({
                  where: {
                    tuid: input.tuid,
                  },
                  data: {
                    name: input.name,
                    onboarding: false,
                  },
                }),
                //Add all courses in the current transaction
                ...(
                  formattedColumns as Required<IProjectsExcelCourseSchema>[]
                ).map((row, index) => {
                  return prisma.course.create(createCourseSchema(row, input));
                }),
              ]
            );
            //Its a valid course!
            if (scheduele != undefined && courses != undefined) {
              return { success: true, errors: [] };
            }
          }
        }
      }
      //Do we have a search query
      return { success: false, errrors: ["Somthing went wrong..."] };
    }),
});

const excelErrorMap: z.ZodErrorMap = (error, ctx) => {
  /*
  This is where you override the various error codes
  */
  switch (error.code) {
    case z.ZodIssueCode.custom:
      // produce a custom message using error.params
      // error.params won't be set unless you passed
      // a `params` arguments into a custom validator
      const params = error.params || {};
      console.log("Custom error?");
      if (params.myField) {
        return { message: `Bad input: ${params.myField}` };
      }
      break;
  }

  // fall back to default message!
  return { message: ctx.defaultError };
};

export const createCourseSchema = (
  row: Required<IProjectsExcelCourseSchema>,
  input: { tuid: string }
) => {
  return {
    data: {
      capacity: row.capacity,
      course_number: row.course_number,
      credits: row.credits,
      department: row.department,
      div: row.div,
      end_date: row.end_date,
      end_time: 0,
      original_state: "UNMODIFIED",
      section: row.section + "",
      section_id: row.section_id,
      start_date: row.start_date,
      state: "UNMODIFIED",
      start_time: 0,
      subject: row.subject,
      term: row.term,
      title: row.title.substring(0, 30),
      type: row.type,
      semester_fall: row.semester_fall,
      semester_winter: row.semester_winter,
      semester_spring: row.semester_spring,
      semester_summer: row.semester_summer,
      status: "",
      instruction_method: row.instruction_method,
      faculty: {
        //now create the many-to-many-relationships which connect faculty
        create: [
          ...row.faculty.map((faculty) => {
            return {
              faculty: {
                connect: {
                  tuid: faculty.faculty_tuid,
                },
              },
            };
          }),
        ],
      },
      locations: {
        create: [
          ...row.locations.map((location) => {
            console.log({
              location,
            });
            return {
              day_friday: location.day_friday,
              day_monday: location.day_monday,
              day_saturday: location.day_saturday,
              day_sunday: location.day_sunday,
              day_thursday: location.day_thursday,
              day_tuesday: location.day_tuesday,
              day_wednesday: location.day_wednesday,
              end_time: location.end_time,
              is_online: location.is_online,
              start_time: location.start_time,
              rooms: {
                create: [
                  ...location.rooms.map((room) => {
                    return {
                      building: {
                        connect: {
                          tuid: room.building_tuid,
                        },
                      },
                      room: room.room,
                    };
                  }),
                ],
              },
            };
          }),
        ],
      },
      revision: {
        connect: {
          tuid: input.tuid,
        },
      },
      notes: {
        create: [
          ...row.notes.map((row) => {
            return {
              note: row.note != undefined ? row.note : "",
              type: row.type,
            };
          }),
        ],
      },
    },
    include: {
      faculty: true,
      locations: true,
      notes: true,
    },
  } as Prisma.CourseCreateArgs;
};

const invertedNestedOrganizedColumns = async (
  columns: ExcelDataColumns,
  organizedColumns: IProjectOrganizedColumnRowNumerical
) => {
  //Inverts columns, really handy
  const invertOrganizedColumns = Object.entries(organizedColumns).reduce(
    (a, [k, v]) => ({ ...a, [v]: k }),
    {}
  ) as InvertedObject;

  const getIndexFromOrganizedColumns = (index: number): string => {
    //Have to set type 'unknown as string' so that TS will not error out
    //as its assuming that the type could be a possible undefined, which is true
    //but said value but that's discarded later on, so it doesn't affect the outcome
    const indexKey = invertOrganizedColumns[index] as unknown as string;
    return indexKey == undefined ? "_" : indexKey;
  };

  /**
   * invertedOrganizedColumns
   * Converts the columns from the inverted key: value to value: key
   * based on the rows provided by the client as a lookup table
   */
  const invertedOrganizedColumns = columns
    .splice(1)
    .map(
      (c) =>
        //Reduce each row by adding a new key to each row
        c.reduce(
          (obj, item, index) => ({
            ...obj,
            //get the name of the key and set it to the value of the item
            [getIndexFromOrganizedColumns(index)]: `${item}`,
          }),
          {}
        )
      //make sure the type of this is defined
    )
    .filter((ele) => {
      return ele.constructor === Object && Object.keys(ele).length > 0;
    }) as IProjectOrganizedColumnRow[];

  console.log(JSON.stringify(invertedOrganizedColumns));

  //Do we have all of the columns?
  //TODO: Do we need to use this?
  const hasAllColumns = invertedOrganizedColumns.every((row) => {
    return (
      row.noteWhatHasChanged &&
      row.section_id &&
      row.term &&
      row.div &&
      row.department &&
      row.subject &&
      row.course_number &&
      row.section &&
      row.title &&
      row.instruction_method &&
      row.faculty &&
      row.campus &&
      row.credits &&
      row.capacity &&
      row.start_date &&
      row.end_date &&
      row.building &&
      row.room &&
      row.start_time &&
      row.end_time &&
      row.days &&
      row.noteAcademicAffairs &&
      row.notePrintedComments
    );
  });

  //Now query all of the columns with its inverted values and well validate them all!
  const invertedNestedOrganizedColumns = await Promise.all(
    invertedOrganizedColumns.map(async (c) => {
      //Spread all the data we want to split
      const {
        _, //Yes its an underscore. Just removing the key
        //Make sure we get the rest of the data at the end
        ...data
      } = c as IProjectOrganizedColumnRow & { _: string }; //A wonderful unioned type

      //Get the building
      const updatedBuilding =
        data.building != undefined ? data.building.split(/\r\n|\n|\r/) : [];
      const updatedRoom =
        data.room != undefined ? data.room.split(/\r\n|\n|\r/) : [];
      //Start time
      const updatedStart_time =
        data.start_time != undefined
          ? data.start_time.split(/\r\n|\n|\r/).map((c) => c.trim())
          : [];

      //End time
      const updatedEnd_time =
        data.end_time != undefined
          ? data.end_time.split(/\r\n|\n|\r/).map((c) => c.trim())
          : [];

      //Days
      const updatedDays =
        data.days != undefined
          ? data.days
              .trim()
              .split(/\r\n|\n|\r/)
              .map((c) => c.toLowerCase())
          : [];

      //Faculty
      const updateFaculty =
        data.faculty != undefined
          ? data.faculty.trim().split(/\r\n|\n|\r/)
          : [];

      //TODO: Do we need the course global times?
      let start_time_updated = 0;
      let end_time_updated = 0;

      //Converts the time (provided by the excel sheet) into time!
      const convertTimeToMilitary = (value: string) => {
        if (value == undefined) return 0;

        //Start with a string for miltary joinment
        let time = "0";
        //Seperate mins and hours and numiercal
        let minute = 0;
        let hour = 0;

        //Split the time
        const splittedTime = value.split(":");

        //make sure the splitted time isn't undefined or the length has two parts
        if (splittedTime != undefined && splittedTime.length == 2) {
          //Attempt to parse said time. If time can't be parsed, it defaults to 0 then
          try {
            hour = parseInt(splittedTime[0] as string);
            if (value.includes("PM") && hour != 12) {
              console.log("includes PM");
              console.log({ hour });
              hour += 12;
            }
            minute = parseInt(
              //We also cehck to make sure wre only have XX minutes or X minutes based on the length
              //TODO: Check again if this is 100% working still
              splittedTime[1]!.length > 1
                ? (splittedTime[1]?.substring(0, 2) as string)
                : (splittedTime[1]?.substring(0, 1) as string)
            );
          } catch (err) {
            return 0;
          } finally {
            //Merge the time back in
            time = `${hour}${minute == 0 ? "00" : minute}`;
            console.log({ time });
          }
        }
        //Convert it back to a number (because we have too)
        return parseInt(time);
      };

      //Gets the term year based on its seperated slash "/"
      const getTermYear = (term: string) => {
        console.log("Did we error at term?");
        return term.split("/")[0]?.toString();
      };

      //Get the semster and return all of them back because its easier
      const getTermSemester = (term: string) => {
        console.log("Did we error at term year?");
        const semester = term.split("/")[1]?.toString().trim();

        return {
          semester_summer: semester === "SU",
          semester_fall: semester === "FA",
          semester_winter: semester === "WI",
          semester_spring: semester === "SP",
        };
      };

      //Get all of the locations with the times and rooms
      const locations = async () => {
        //Loop over all of the possible building for said course
        //NOTE: Ths has to be done asyncronously to allow for database calls
        const value = await Promise.all(
          updatedBuilding.map(async (item, index) => {
            //Get the times, which are in an object as they could be possible be use for the root of the object (course)
            const times = {
              start_time:
                updatedStart_time != undefined
                  ? convertTimeToMilitary(
                      updatedStart_time[index]?.trim() as string
                    )
                  : 0,
              end_time:
                updatedEnd_time != undefined
                  ? convertTimeToMilitary(
                      updatedEnd_time[index]?.trim() as string
                    )
                  : 0,
            };

            //TODO: Do we need to give the parent the times?

            start_time_updated = times.start_time;
            end_time_updated = times.end_time;

            //See if the building is a valid building.
            //TODO: Also query by location from the root node
            const buildingResult = await prisma.guidelineBuilding.findFirst({
              where: {
                prefix: item,
              },
            });

            //Return the data with the awful online object "building" check,
            //because someone had to put ONL for a building smh
            return {
              building: item,
              rooms: [
                ...(item != "ONL"
                  ? [
                      {
                        room: updatedRoom[index],
                        building_tuid:
                          buildingResult?.tuid != undefined
                            ? buildingResult?.tuid
                            : item,
                      },
                    ]
                  : []),
              ],
              //Add the times
              ...times,
              //Because item (this current map we are in) is the building we can check for if its ONL
              is_online: item === "ONL",
              //Days basically
              day_monday: updatedDays.includes("m"),
              day_tuesday: updatedDays.includes("t"),
              day_wednesday: updatedDays.includes("w"),
              day_thursday:
                updatedDays.includes("r") || updatedDays.includes("th"),
              day_friday: updatedDays.includes("f"),
              day_saturday: updatedDays.includes("sat"),
              day_sunday: updatedDays.includes("sun"),
            };
          }, {})
        );
        //Return the locations back for merged parent
        return value;
      };

      //Now we do faculty members
      const faculty = async () => {
        //Again we want to do some prisma querying, so make it async for all calls
        const value = await Promise.all(
          updateFaculty.map(async (faculty) => {
            //Check the faculty member by name (lowercase)
            const resultFaculty = await prisma.guidelinesFaculty.findFirst({
              where: {
                name: faculty.toLowerCase(),
              },
            });
            //That's it, faculty member has been check. Will be null if can't be found and the validation doesn't allow it.
            return {
              faculty_tuid:
                resultFaculty?.tuid != undefined
                  ? resultFaculty?.tuid
                  : faculty,
            };
          })
        );
        return value;
      };

      //The merged ouput of the course
      const mergedCourseOutput = {
        section_id:
          data.section_id == undefined ? null : parseInt(data.section_id),
        type: "Unknown", //TODO: Figure out what type was supposed to be again
        //Term as a date
        term: parseInt(getTermYear(data.term) || new Date().getFullYear() + ""),
        ...getTermSemester(data.term),
        div: data.div,
        department: data.department,
        subject: data.subject,
        course_number: data.course_number,
        section: parseInt(data.section) || data.section,
        //The "excel time" to js time
        start_date: new Date(
          Date.UTC(0, 0, (parseInt(data.start_date) || 0) - 1)
        ),
        //The "excel time" to js time
        end_date: new Date(Date.UTC(0, 0, (parseInt(data.end_date) || 0) - 1)),
        credits: parseInt(data.credits) || 0,
        title: data.title,
        capacity: parseInt(data.capacity) || 0,
        //Add faculty and locations
        faculty: [...(await faculty())],
        locations: [
          ...(await locations()),
          // {
          //   end_time: 1020,
          //   start_time: 830,
          //   is_online: false,
          //   day_monday: false,
          //   day_tuesday: false,
          //   day_wednesday: false,
          //   day_thursday: false,
          //   day_friday: false,
          //   day_saturday: false,
          //   day_sunday: false,
          //   rooms: [
          //     {
          //       room: "100",
          //     },
          //   ],
          // },
        ],
        //The notes
        notes: [
          {
            note: data.noteAcademicAffairs,
            type: "ACAMDEMIC_AFFAIRS",
          },
          {
            note: data.notePrintedComments,
            type: "DEPARTMENT",
          },
          {
            note: data.noteWhatHasChanged,
            type: "CHANGES",
          },
        ],
      } as Partial<IProjectsExcelCourseSchema>;

      //Return each course output
      return mergedCourseOutput;
    })
  );
  //Return all course output
  return invertedNestedOrganizedColumns;
};
