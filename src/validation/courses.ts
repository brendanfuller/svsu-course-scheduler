import { z } from "zod";

/**
 * Times Schema Extended
 */
const timesSchemaExtended = z
  .object({
    guideline_id: z.string().optional(),
    tuid: z.string().optional(),
    start_time: z.number(),
    end_time: z.number(),
  })

  //Refine the time object
  .superRefine(async (val, ctx) => {
    //Make sure the start time is NOT before the end time
    if (val.start_time > val.end_time) {
      //Add the issue
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tuid"],
        message: `End time cannot occur before start time!`,
      });
    }
  });

const daysSchema = z
  .object({
    guideline_id: z.string().optional(),
    tuid: z.string().optional(),
    day_monday: z.boolean().default(false),
    day_tuesday: z.boolean().default(false),
    day_wednesday: z.boolean().default(false),
    day_thursday: z.boolean().default(false),
    day_friday: z.boolean().default(false),
    day_saturday: z.boolean().default(false),
    day_sunday: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    const hasDay =
      val.day_monday ||
      val.day_tuesday ||
      val.day_wednesday ||
      val.day_thursday ||
      val.day_friday ||
      val.day_saturday ||
      val.day_sunday;
    if (hasDay == false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tuid"],
        message: "Select at least one day.",
      });
    }
  });

/**
 * Course Guideline Validation & Schemas
 */
export const guidelineCourseAddSchemaBase = z.object({
  tuid: z.string().optional(),
  semester_summer: z.boolean().default(false),
  semester_fall: z.boolean().default(false),
  semester_winter: z.boolean().default(false),
  semester_spring: z.boolean().default(false),

  credits: z
    .number({
      errorMap: (issue, ctx) => {
        return { message: "Enter a number." };
      },
    })
    .min(1)
    .max(4, { message: "Credits must be between 1 and 4." })
    .nullable(),

  meeting_amount: z
    .number({
      errorMap: (issue, ctx) => {
        return { message: "Enter a number." };
      },
    })
    .min(1)
    .max(4, { message: "Meeting amount must be between 1 and 4." })
    .nullable(),

  times: z
    .array(timesSchemaExtended)
    .min(1, { message: "At least one time is required." }),

  days: z
    .array(daysSchema)
    .min(1, { message: "At least one day block is required." }),
});

export const guidelineCourseAddSchema =
  guidelineCourseAddSchemaBase.superRefine((val, ctx) => {
    const hasSemester =
      val.semester_fall ||
      val.semester_summer ||
      val.semester_spring ||
      val.semester_winter;
    if (hasSemester == false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tuid"],
        message: "Select at least one semester.",
      });
    }
  });

export const guidelineCourseUpdateSchema = guidelineCourseAddSchemaBase
  .extend({
    tuid: z.string().optional(),
    days: z.array(daysSchema),
    times: z.array(timesSchemaExtended),
  })
  .superRefine((val, ctx) => {
    const hasSemester =
      val.semester_fall ||
      val.semester_summer ||
      val.semester_spring ||
      val.semester_winter;
    if (hasSemester == false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tuid"],
        message: "Select at least one semester.",
      });
    }
  });

export type IGuidelineCourseAdd = z.infer<typeof guidelineCourseAddSchema>;
export type IGuidelineCourseUpdate = z.infer<
  typeof guidelineCourseUpdateSchema
>;
