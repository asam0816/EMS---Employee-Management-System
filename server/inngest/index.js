import { Inngest } from "inngest";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import sendEmail from "../config/nodemailer.js";

import {
  addDaysToDateKey,
  buildColomboInstant,
  getColomboDateKey,
} from "../utils/colomboTime.js";

// ======================================================
// INNGEST CLIENT
// ======================================================

export const inngest = new Inngest({
  id: "fullstack-ems",
});

// ======================================================
// ATTENDANCE REMINDER CONFIGURATION
// ======================================================

const SHIFT_REMINDERS = {
  DAY: {
    shiftKey: "DAY",
    shiftName: "Day Shift",

    shiftStartLabel: "08:00 AM",
    reminderLabel: "08:30 AM",

    // 08:30 AM Sri Lanka time
    cron: "TZ=Asia/Colombo 30 8 * * *",
  },

  NIGHT: {
    shiftKey: "NIGHT",
    shiftName: "Night Shift",

    shiftStartLabel: "07:00 PM",
    reminderLabel: "07:30 PM",

    // 07:30 PM Sri Lanka time
    cron: "TZ=Asia/Colombo 30 19 * * *",
  },
};

// ======================================================
// COLOMBO DATE RANGE
// ======================================================

const getColomboDayBounds = (dateKey) => {
  const nextDateKey = addDaysToDateKey(dateKey, 1);

  return {
    start: buildColomboInstant(dateKey, 0, 0, 0, 0),

    end: buildColomboInstant(nextDateKey, 0, 0, 0, 0),
  };
};

// ======================================================
// AUTO CHECKOUT
// Existing functionality
// ======================================================

const autoCheckOut = inngest.createFunction(
  {
    id: "auto-check-out",

    triggers: {
      event: "employee/check-out",
    },
  },

  async ({ event, step }) => {
    const { employeeId, attendanceId } = event.data;

    // Wait 9 hours
    await step.sleepUntil(
      "wait-for-the-9-hours",

      new Date(Date.now() + 9 * 60 * 60 * 1000),
    );

    let attendance = await Attendance.findById(attendanceId);

    if (!attendance?.checkOut) {
      const employee = await Employee.findById(employeeId);

      if (employee) {
        await sendEmail({
          to: employee.email,

          subject: "Attendance Check-Out Reminder",

          body: `
            <div
              style="
                max-width: 600px;
                font-family: Arial, sans-serif;
              "
            >
              <h2>
                Hi ${employee.firstName}, 👋
              </h2>

              <p style="font-size: 16px;">
                You checked in today at:
              </p>

              <p
                style="
                  font-size: 18px;
                  font-weight: bold;
                  color: #007bff;
                  margin: 8px 0;
                "
              >
                ${attendance?.checkIn?.toLocaleTimeString()}
              </p>

              <p style="font-size: 16px;">
                Please remember to check out.
              </p>

              <p style="font-size: 16px;">
                If you have any questions,
                please contact your admin.
              </p>

              <br />

              <p style="font-size: 16px;">
                Best Regards,
              </p>

              <p style="font-size: 16px;">
                TechTitans
              </p>
            </div>
          `,
        });
      }

      // Wait another hour
      await step.sleepUntil(
        "wait-for-the-1-hour",

        new Date(Date.now() + 1 * 60 * 60 * 1000),
      );

      attendance = await Attendance.findById(attendanceId);

      if (attendance && !attendance.checkOut) {
        attendance.checkOut =
          new Date(attendance.checkIn).getTime() + 4 * 60 * 60 * 1000;

        attendance.workingHours = 4;

        attendance.dayType = "Half Day";

        attendance.status = "LATE";

        await attendance.save();
      }
    }
  },
);

// ======================================================
// LEAVE REMINDER
// Existing functionality
// ======================================================

const leaveApplicationReminder = inngest.createFunction(
  {
    id: "leave-application-reminder",

    triggers: {
      event: "leave/pending",
    },
  },

  async ({ event, step }) => {
    const { leaveApplicationId } = event.data;

    await step.sleepUntil(
      "wait-for-the-24-hours",

      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );

    const leaveApplication =
      await LeaveApplication.findById(leaveApplicationId);

    if (leaveApplication?.status === "PENDING") {
      const employee = await Employee.findById(leaveApplication.employeeId);

      if (employee) {
        await sendEmail({
          to: process.env.ADMIN_EMAIL,

          subject: "Leave Application Reminder",

          body: `
              <div
                style="
                  max-width: 600px;
                  font-family: Arial, sans-serif;
                "
              >
                <h2>
                  Hi Admin, 👋
                </h2>

                <p style="font-size: 16px;">
                  You have a pending leave
                  application from
                  ${employee.firstName}
                  ${employee.lastName}.
                </p>

                <p
                  style="
                    font-size: 18px;
                    font-weight: bold;
                    color: #007bff;
                  "
                >
                  ${leaveApplication?.startDate?.toLocaleDateString()}
                </p>

                <p style="font-size: 16px;">
                  Please review the leave
                  application.
                </p>

                <br />

                <p>
                  Best Regards,
                </p>

                <p>
                  TechTitans
                </p>
              </div>
            `,
        });
      }
    }
  },
);

// ======================================================
// ATTENDANCE REMINDER CREATOR
// ======================================================

const createAttendanceReminderFunction = (config) =>
  inngest.createFunction(
    {
      id: `attendance-reminder-${config.shiftKey.toLowerCase()}`,

      triggers: {
        cron: config.cron,
      },
    },

    async ({ step }) => {
      // ----------------------------------------------
      // TODAY - COLOMBO DATE
      // ----------------------------------------------

      const dateKey = await step.run(
        `get-${config.shiftKey.toLowerCase()}-work-date`,

        () => getColomboDateKey(new Date()),
      );

      const dayBounds = getColomboDayBounds(dateKey);

      // ----------------------------------------------
      // GET ONLY EMPLOYEES FOR THIS SHIFT
      // ----------------------------------------------

      const employees = await step.run(
        `get-active-${config.shiftKey.toLowerCase()}-employees`,

        async () => {
          const rows = await Employee.find({
            isDeleted: {
              $ne: true,
            },

            employmentStatus: "ACTIVE",

            // IMPORTANT:
            // Day reminder only DAY.
            // Night reminder only NIGHT.
            shiftKey: config.shiftKey,

            joinDate: {
              $lt: dayBounds.end,
            },
          })
            .select("firstName lastName email department shiftKey")
            .lean();

          return rows.map((employee) => ({
            _id: employee._id.toString(),

            firstName: employee.firstName,

            lastName: employee.lastName,

            email: employee.email,

            department: employee.department,

            shiftKey: employee.shiftKey,
          }));
        },
      );

      // No employees for this shift
      if (employees.length === 0) {
        return {
          shiftKey: config.shiftKey,

          dateKey,

          totalEmployees: 0,

          reminded: 0,
        };
      }

      const employeeIds = employees.map((employee) => employee._id);

      // ----------------------------------------------
      // CHECK APPROVED LEAVE
      // ----------------------------------------------

      const onLeaveIds = await step.run(
        `get-${config.shiftKey.toLowerCase()}-leave-employees`,

        async () => {
          const leaves = await LeaveApplication.find({
            employeeId: {
              $in: employeeIds,
            },

            status: "APPROVED",

            startDate: {
              $lt: dayBounds.end,
            },

            endDate: {
              $gte: dayBounds.start,
            },
          })
            .select("employeeId")
            .lean();

          return [
            ...new Set(leaves.map((leave) => leave.employeeId.toString())),
          ];
        },
      );

      // ----------------------------------------------
      // CHECK WHO ALREADY CLOCKED IN
      // ----------------------------------------------
      //
      // IMPORTANT:
      //
      // Your old code used:
      //
      // date: { ... }
      //
      // But Attendance.js DOES NOT have
      // a `date` field.
      //
      // Your model uses:
      //
      // attendanceDateKey
      //
      // ----------------------------------------------

      const checkedInIds = await step.run(
        `get-${config.shiftKey.toLowerCase()}-checked-in-employees`,

        async () => {
          const rows = await Attendance.find({
            employeeId: {
              $in: employeeIds,
            },

            attendanceDateKey: dateKey,

            // Must match exact
            // employee shift.
            shiftKey: config.shiftKey,

            checkIn: {
              $ne: null,
            },
          })
            .select("employeeId")
            .lean();

          return [...new Set(rows.map((row) => row.employeeId.toString()))];
        },
      );

      const onLeaveSet = new Set(onLeaveIds);

      const checkedInSet = new Set(checkedInIds);

      // ----------------------------------------------
      // ONLY EMPLOYEES WITHOUT CLOCK-IN
      // ----------------------------------------------

      const employeesMissingClockIn = employees.filter(
        (employee) =>
          !onLeaveSet.has(employee._id) && !checkedInSet.has(employee._id),
      );

      let reminded = 0;

      let skippedBecauseClockedIn = 0;

      // ----------------------------------------------
      // SEND EMAILS
      // ----------------------------------------------

      for (const employee of employeesMissingClockIn) {
        const result = await step.run(
          `send-${config.shiftKey.toLowerCase()}-attendance-reminder-${
            employee._id
          }`,

          async () => {
            // Recheck immediately
            // before email.
            //
            // Example:
            //
            // Cron starts 08:30:00
            // employee clocks in 08:30:02
            // processing email 08:30:03
            //
            // This check prevents
            // unnecessary email.

            const attendanceExists = await Attendance.exists({
              employeeId: employee._id,

              attendanceDateKey: dateKey,

              shiftKey: config.shiftKey,

              checkIn: {
                $ne: null,
              },
            });

            if (attendanceExists) {
              return {
                sent: false,

                reason: "CLOCKED_IN",
              };
            }

            // --------------------------------------
            // SEND REMINDER
            // --------------------------------------

            await sendEmail({
              to: employee.email,

              subject: `${config.shiftName} Attendance Reminder`,

              body: `
                    <div
                      style="
                        max-width: 600px;
                        margin: 0 auto;
                        font-family: Arial, sans-serif;
                        color: #1e293b;
                      "
                    >

                      <h2>
                        Hi ${employee.firstName}, 👋
                      </h2>

                      <p
                        style="
                          font-size: 16px;
                          line-height: 1.6;
                        "
                      >
                        We did not find a
                        clock-in for your
                        <strong>
                          ${config.shiftName}
                        </strong>
                        today.
                      </p>

                      <p
                        style="
                          font-size: 16px;
                          line-height: 1.6;
                        "
                      >
                        Your shift starts at
                        <strong>
                          ${config.shiftStartLabel}
                        </strong>.
                      </p>

                      <p
                        style="
                          font-size: 16px;
                          line-height: 1.6;
                        "
                      >
                        This reminder was sent at
                        <strong>
                          ${config.reminderLabel}
                        </strong>.
                      </p>

                      <p
                        style="
                          font-size: 16px;
                          line-height: 1.6;
                        "
                      >
                        Please clock in as soon
                        as possible or contact
                        your administrator if
                        you are unable to attend.
                      </p>

                      <div
                        style="
                          margin-top: 24px;
                          padding: 14px;
                          background: #f8fafc;
                          border-radius: 8px;
                        "
                      >
                        <p
                          style="
                            margin: 0;
                            font-size: 14px;
                            color: #64748b;
                          "
                        >
                          Department:
                          ${employee.department || "-"}
                        </p>

                        <p
                          style="
                            margin: 6px 0 0;
                            font-size: 14px;
                            color: #64748b;
                          "
                        >
                          Shift:
                          ${config.shiftName}
                        </p>

                        <p
                          style="
                            margin: 6px 0 0;
                            font-size: 14px;
                            color: #64748b;
                          "
                        >
                          Date:
                          ${dateKey}
                        </p>
                      </div>

                      <br />

                      <p>
                        Best Regards,
                      </p>

                      <p>
                        <strong>
                          TechTitans
                        </strong>
                      </p>

                    </div>
                  `,
            });

            return {
              sent: true,
            };
          },
        );

        if (result?.sent) {
          reminded += 1;
        }

        if (result?.reason === "CLOCKED_IN") {
          skippedBecauseClockedIn += 1;
        }
      }

      return {
        shiftKey: config.shiftKey,

        dateKey,

        totalEmployees: employees.length,

        onLeave: onLeaveIds.length,

        alreadyClockedIn: checkedInIds.length + skippedBecauseClockedIn,

        missingClockIn: employeesMissingClockIn.length,

        reminded,
      };
    },
  );

// ======================================================
// DAY SHIFT
//
// Runs ONLY:
// 08:30 AM Asia/Colombo
// ======================================================

const dayShiftAttendanceReminder = createAttendanceReminderFunction(
  SHIFT_REMINDERS.DAY,
);

// ======================================================
// NIGHT SHIFT
//
// Runs ONLY:
// 07:30 PM Asia/Colombo
// ======================================================

const nightShiftAttendanceReminder = createAttendanceReminderFunction(
  SHIFT_REMINDERS.NIGHT,
);

// ======================================================
// EXPORT FUNCTIONS
// ======================================================

export const functions = [
  autoCheckOut,

  leaveApplicationReminder,

  dayShiftAttendanceReminder,

  nightShiftAttendanceReminder,
];
