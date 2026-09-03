CREATE INDEX `idx_quizzes_assigned_class` ON `quizzes` (`assigned_class_id`);--> statement-breakpoint
CREATE INDEX `idx_submissions_quiz_id` ON `submissions` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `idx_submissions_student_class` ON `submissions` (`student_name`,`class_name`);