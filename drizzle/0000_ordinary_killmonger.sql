CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`students_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`education_level` text NOT NULL,
	`grade` text NOT NULL,
	`subject` text NOT NULL,
	`bloom_json` text DEFAULT '[]' NOT NULL,
	`questions_json` text DEFAULT '[]' NOT NULL,
	`assigned_class_id` text,
	`teacher_email` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`student_name` text NOT NULL,
	`class_name` text NOT NULL,
	`score` integer NOT NULL,
	`correct_count` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`duration_seconds` integer NOT NULL,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`answers_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
