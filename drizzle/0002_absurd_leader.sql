ALTER TABLE `classrooms` ADD `code` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_classrooms_code` ON `classrooms` (`code`);--> statement-breakpoint
ALTER TABLE `quizzes` ADD `deadline` text;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `time_limit_minutes` integer;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `max_attempts` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `student_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `class_id` text;--> statement-breakpoint
CREATE INDEX `idx_submissions_quiz_student_code` ON `submissions` (`quiz_id`,`student_code`,`class_id`);--> statement-breakpoint
PRAGMA optimize;
