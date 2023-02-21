import { CourseNoteType, CourseState } from "@prisma/client";
import { z } from "zod";

const timesSchema = z.object({
  start_time: z.number().min(0).max(2200, {
    message: "The hour a course starts must be between 0 and 24 hours.",
  }),
  end_time: z.number().min(0).max(2359, {
    message: "The minute a course starts must be between 0 and 59 minutes.",
  }),
});

const timesSchemaExtended = z.object({
  guideline_id: z.string().optional(),
  tuid: z.string().optional(),
  start_time: z.object({
    hour: z.number().min(0).max(23, {
      message: "The hour a course starts must be between 0 and 24 hours.",
    }),
    minute: z.number().min(0).max(59, {
      message: "The minute a course starts must be between 0 and 59 minutes.",
    }),
    anteMeridiem: z.string(),
    anteMeridiemHour: z.number().min(0).max(12, {
      message: "The hour a course starts must be between 0 and 12 hours.",
    }),
  }),

  end_time: z.object({
    hour: z.number().min(0).max(23, {
      message: "The hour a course starts must be between 0 and 24 hours.",
    }),
    minute: z.number().min(0).max(59, {
      message: "The minute a course starts must be between 0 and 59 minutes.",
    }),
    anteMeridiem: z.string(),
    anteMeridiemHour: z.number().min(0).max(12, {
      message: "The hour a course starts must be between 0 and 12 hours.",
    }),
  }),
});

const daysSchema = z.object({
  guideline_id: z.string().optional(),
  tuid: z.string().optional(),
  day_monday: z.boolean().default(false),
  day_tuesday: z.boolean().default(false),
  day_wednesday: z.boolean().default(false),
  day_thursday: z.boolean().default(false),
  day_friday: z.boolean().default(false),
  day_saturday: z.boolean().default(false),
  day_sunday: z.boolean().default(false),
});

export const addGuidelineSchema = z.object({
  tuid: z.string().optional(),
  semester_summer: z.boolean().default(false),
  semester_fall: z.boolean().default(false),
  semester_winter: z.boolean().default(false),
  semester_spring: z.boolean().default(false),

  credits: z
    .number()
    .min(1)
    .max(4, { message: "Credits must be between 1 and 4." }),

  meeting_amount: z
    .number()
    .min(1)
    .max(4, { message: "Meeting amount must be between 1 and 4." }),

  times: z.array(timesSchemaExtended),

  days: z.array(daysSchema),
});

export const updateCourseGuidelineSchema = addGuidelineSchema.extend({
  tuid: z.string().optional(),
  days: z.array(
    daysSchema.extend({
      tuid: z.string(),
    })
  ),
  times: z.array(
    timesSchema.extend({
      tuid: z.string(),
    })
  ),
});

const facultyToCourseSchema = z.object({
  faculty_tuid: z
    .string()
    .cuid({ message: "Must be an exisitng faculty member!" }),
  course_tuid: z.string().optional(),
});

const revisionSchema = z.object({
  tuid: z.string(),
  name: z.string(),
  schedule_tuid: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  onboarding: z.boolean(),
  creator_tuid: z.string(),
});

const notesSchema = z.object({
  tuid: z.string().optional(),
  note: z.string().optional(),
  type: z.nativeEnum(CourseNoteType),
});

const roomsSchema = z.object({
  room: z.string(),
  building_tuid: z.string().cuid().optional().nullable(),
});

const locationsSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  day_monday: z.boolean().default(false),
  day_tuesday: z.boolean().default(false),
  day_wednesday: z.boolean().default(false),
  day_thursday: z.boolean().default(false),
  day_friday: z.boolean().default(false),
  day_saturday: z.boolean().default(false),
  day_sunday: z.boolean().default(false),
  is_online: z.boolean().default(false),
  rooms: z.array(roomsSchema),
});

//Provides the two digit year
const twoDigitYear = parseInt(
  new Date().getFullYear().toString().substr(2, 2),
  10
);

export const courseSchema = z
  .object({
    tuid: z.string().optional(),
    type: z.string(),
    section_id: z.number().min(1).default(1),
    revision_tuid: z.string().optional(),
    term: z
      .number()
      .min(twoDigitYear - 2)
      .max(twoDigitYear + 2),
    semester_summer: z.boolean().default(false),
    semester_fall: z.boolean().default(false),
    semester_winter: z.boolean().default(false),
    semester_spring: z.boolean().default(false),
    div: z.string(),
    department: z
      .string()
      .min(2)
      .max(6, { message: "Department type is larger than expected." }),
    subject: z
      .string()
      .min(2)
      .max(6, { message: "Subject type is larger than expected." }),
    course_number: z.string(),
    section: z.number().min(0).max(500),
    start_date: z.date(),
    end_date: z.date(),
    // start_time: z.number().min(0).max(2200, {
    //   message: "The hour a course starts must be between 0 and 24 hours.",
    // }),
    // end_time: z.number().min(0).max(2359, {
    //   message: "The minute a course starts must be between 0 and 59 minutes.",
    // }),
    credits: z.number(),
    title: z.string().min(7).max(100),
    status: z.string().default("Active"),
    //faculty_tuid: z.string(),
    instruction_method: z.string().default("LEC"),
    capacity: z.number().min(1).max(500, {
      message: "Capacity has a limit of 500 students on a course.",
    }),
    original_state: z.nativeEnum(CourseState).default("UNMODIFIED"),
    state: z.nativeEnum(CourseState).default("UNMODIFIED"),
    faculty: z.array(facultyToCourseSchema).min(1, {
      message: "A faculty member must be present on a course.",
    }),
    notes: z.array(notesSchema).min(3),
    locations: z.array(locationsSchema),
  })
  .partial()
  .refine(
    ({ semester_fall, semester_winter, semester_spring, semester_summer }) =>
      !(
        semester_fall == false &&
        semester_winter == false &&
        semester_spring == false &&
        semester_summer == false
      ),
    { message: "A course must have a semester defined based on the term" }
  );

export const addNewRevisionCourse = z.object({
  tuid: z.string().optional(),
  course: courseSchema,
});

export type IAddGuidelineCourse = z.infer<typeof addGuidelineSchema>;
export type IUpdateGuidelineCourse = z.infer<
  typeof updateCourseGuidelineSchema
>;

export type ICourseSchema = z.infer<typeof courseSchema>;
