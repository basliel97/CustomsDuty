CREATE TABLE "assessment_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"appeal_number" varchar(30) NOT NULL,
	"filed_by_id" uuid NOT NULL,
	"filed_reason" text NOT NULL,
	"supporting_docs" jsonb,
	"status" varchar(20) DEFAULT 'FILED' NOT NULL,
	"assigned_to_id" uuid,
	"resolution" text,
	"adjusted_amount" numeric(14, 2),
	"filed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assessment_appeals_appeal_number_unique" UNIQUE("appeal_number")
);
--> statement-breakpoint
CREATE TABLE "assessment_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessment_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"document_type" varchar(30) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"hs_code_id" uuid NOT NULL,
	"item_description" text NOT NULL,
	"country_of_origin_id" uuid,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_price_foreign" numeric(14, 4) NOT NULL,
	"total_fob_foreign" numeric(14, 2) DEFAULT '0' NOT NULL,
	"freight_foreign" numeric(14, 2) DEFAULT '0' NOT NULL,
	"insurance_foreign" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cif_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"duty_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"excise_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"surtax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"withholding_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_item_tax_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"from_status" varchar(30),
	"to_status" varchar(30) NOT NULL,
	"changed_by_id" uuid NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_number" varchar(30) NOT NULL,
	"consignment_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"declarant_name" varchar(200) NOT NULL,
	"declarant_tin" varchar(20) NOT NULL,
	"declarant_passport_no" varchar(30),
	"declarant_phone" varchar(20),
	"declarant_email" varchar(255),
	"branch_id" uuid NOT NULL,
	"port_of_entry_id" uuid,
	"currency" varchar(3) NOT NULL,
	"exchange_rate_applied" numeric(14, 4) NOT NULL,
	"total_cif_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_duty_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_excise_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_vat_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_surtax_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_withholding_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_scanning_fee_etb" numeric(14, 2) DEFAULT '200' NOT NULL,
	"total_payable_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_paid_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"remaining_balance_etb" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" varchar(30) DEFAULT 'DRAFT' NOT NULL,
	"exemption_type" varchar(20) DEFAULT 'NONE' NOT NULL,
	"exemption_doc_id" uuid,
	"submitted_at" timestamp with time zone,
	"reviewed_by_officer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"qr_verification_hash" varchar(500),
	"paid_at" timestamp with time zone,
	"payment_reference" varchar(100),
	"expires_at" timestamp with time zone,
	"idempotency_key" varchar(100),
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assessments_assessment_number_unique" UNIQUE("assessment_number"),
	CONSTRAINT "assessments_qr_verification_hash_unique" UNIQUE("qr_verification_hash"),
	CONSTRAINT "assessments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"entity_name" varchar(100) NOT NULL,
	"entity_id" uuid,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(100),
	"session_id" uuid,
	"duration_ms" integer,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_am" varchar(200),
	"address" text,
	"city" varchar(100) NOT NULL,
	"region" varchar(100) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "commodity_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"code" varchar(10) NOT NULL,
	"name_en" varchar(300) NOT NULL,
	"name_am" varchar(300),
	"description" text,
	"level" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commodity_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "consignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consignment_number" varchar(30) NOT NULL,
	"assessment_id" uuid,
	"origin_country_id" uuid NOT NULL,
	"port_of_entry_id" uuid NOT NULL,
	"vessel_name" varchar(200),
	"vessel_voyage" varchar(50),
	"container_number" varchar(30),
	"container_count" integer DEFAULT 1 NOT NULL,
	"container_type" varchar(30),
	"gross_weight_kg" numeric(14, 4),
	"net_weight_kg" numeric(14, 4),
	"total_packages" integer,
	"bl_number" varchar(50),
	"awb_number" varchar(50),
	"eta_date" date,
	"atd_date" date,
	"ata_date" date,
	"status" varchar(30) DEFAULT 'IN_TRANSIT' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "consignments_consignment_number_unique" UNIQUE("consignment_number")
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(3) NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_am" varchar(200),
	"region" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "countries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"summary_date" date NOT NULL,
	"branch_id" uuid NOT NULL,
	"total_assessments" integer DEFAULT 0 NOT NULL,
	"submitted_count" integer DEFAULT 0 NOT NULL,
	"approved_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"total_cif_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_revenue_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_duty_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_vat_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_excise_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_surtax_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_withholding_etb" numeric(16, 2) DEFAULT '0' NOT NULL,
	"generated_by_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forex_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" varchar(3) NOT NULL,
	"exchange_rate_to_etb" numeric(14, 4) NOT NULL,
	"previous_rate" numeric(14, 4),
	"change_amount" numeric(14, 4),
	"change_percentage" numeric(8, 4),
	"effective_date" date NOT NULL,
	"set_by_user_id" uuid NOT NULL,
	"source" varchar(100) DEFAULT 'NBE',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "hs_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"code" varchar(10) NOT NULL,
	"description_en" text NOT NULL,
	"description_am" text,
	"unit_of_measurement" varchar(20) NOT NULL,
	"duty_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"excise_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(6, 4) DEFAULT '0.15' NOT NULL,
	"surtax_rate" numeric(6, 4) DEFAULT '0.10' NOT NULL,
	"withholding_rate" numeric(6, 4) DEFAULT '0.03' NOT NULL,
	"minimum_duty_floor" numeric(14, 2),
	"is_exempt_eligible" boolean DEFAULT false NOT NULL,
	"is_capital_goods" boolean DEFAULT false NOT NULL,
	"is_raw_material" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "hs_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"channel" varchar(10) NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"type" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "password_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"payment_number" varchar(30) NOT NULL,
	"amount_etb" numeric(14, 2) NOT NULL,
	"payment_method" varchar(20) NOT NULL,
	"payment_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"bank_name" varchar(200),
	"bank_reference" varchar(100),
	"receipt_number" varchar(100),
	"paid_at" timestamp with time zone,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "payment_records_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"name_am" varchar(200),
	"type" varchar(20) NOT NULL,
	"city" varchar(100) NOT NULL,
	"branch_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ports_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rate_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hs_code_id" uuid NOT NULL,
	"tax_component" varchar(20) NOT NULL,
	"override_rate" numeric(6, 4) NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"decree_reference" varchar(200) NOT NULL,
	"reason" text,
	"created_by_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scanning_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"report_number" varchar(30) NOT NULL,
	"scanned_by_id" uuid NOT NULL,
	"scan_date" timestamp with time zone NOT NULL,
	"scan_result" varchar(30) NOT NULL,
	"physical_inspection" boolean DEFAULT false NOT NULL,
	"inspection_notes" text,
	"discrepancies_found" boolean DEFAULT false NOT NULL,
	"discrepancy_details" text,
	"weight_verified_kg" numeric(14, 4),
	"package_count_verified" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scanning_reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" text NOT NULL,
	"value_type" varchar(10) DEFAULT 'STRING' NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_configs_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"device_info" varchar(200),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"phone" varchar(20),
	"badge_number" varchar(50),
	"branch_id" uuid,
	"role" varchar(30) DEFAULT 'IMPORTER' NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"avatar_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_badge_number_unique" UNIQUE("badge_number")
);
--> statement-breakpoint
ALTER TABLE "assessment_appeals" ADD CONSTRAINT "assessment_appeals_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_appeals" ADD CONSTRAINT "assessment_appeals_filed_by_id_users_id_fk" FOREIGN KEY ("filed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_appeals" ADD CONSTRAINT "assessment_appeals_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_comments" ADD CONSTRAINT "assessment_comments_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_comments" ADD CONSTRAINT "assessment_comments_parent_id_assessment_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."assessment_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_comments" ADD CONSTRAINT "assessment_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_documents" ADD CONSTRAINT "assessment_documents_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_documents" ADD CONSTRAINT "assessment_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_documents" ADD CONSTRAINT "assessment_documents_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_hs_code_id_hs_codes_id_fk" FOREIGN KEY ("hs_code_id") REFERENCES "public"."hs_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_country_of_origin_id_countries_id_fk" FOREIGN KEY ("country_of_origin_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_status_history" ADD CONSTRAINT "assessment_status_history_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_status_history" ADD CONSTRAINT "assessment_status_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_consignment_id_consignments_id_fk" FOREIGN KEY ("consignment_id") REFERENCES "public"."consignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_port_of_entry_id_ports_id_fk" FOREIGN KEY ("port_of_entry_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_reviewed_by_officer_id_users_id_fk" FOREIGN KEY ("reviewed_by_officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commodity_categories" ADD CONSTRAINT "commodity_categories_parent_id_commodity_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."commodity_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_origin_country_id_countries_id_fk" FOREIGN KEY ("origin_country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_port_of_entry_id_ports_id_fk" FOREIGN KEY ("port_of_entry_id") REFERENCES "public"."ports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_generated_by_id_users_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forex_rates" ADD CONSTRAINT "forex_rates_set_by_user_id_users_id_fk" FOREIGN KEY ("set_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hs_codes" ADD CONSTRAINT "hs_codes_category_id_commodity_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."commodity_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_notification_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."notification_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ports" ADD CONSTRAINT "ports_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_overrides" ADD CONSTRAINT "rate_overrides_hs_code_id_hs_codes_id_fk" FOREIGN KEY ("hs_code_id") REFERENCES "public"."hs_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_overrides" ADD CONSTRAINT "rate_overrides_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanning_reports" ADD CONSTRAINT "scanning_reports_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanning_reports" ADD CONSTRAINT "scanning_reports_scanned_by_id_users_id_fk" FOREIGN KEY ("scanned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_items_line_idx" ON "assessment_items" USING btree ("assessment_id","line_number");--> statement-breakpoint
CREATE INDEX "assessments_status_idx" ON "assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assessments_tin_idx" ON "assessments" USING btree ("declarant_tin");--> statement-breakpoint
CREATE INDEX "assessments_branch_idx" ON "assessments" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "assessments_created_by_idx" ON "assessments" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "assessments_officer_idx" ON "assessments" USING btree ("reviewed_by_officer_id");--> statement-breakpoint
CREATE INDEX "assessments_created_at_idx" ON "assessments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assessments_submitted_idx" ON "assessments" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_name","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "audit_logs_request_idx" ON "audit_logs" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_summaries_date_branch_idx" ON "daily_summaries" USING btree ("summary_date","branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forex_rates_currency_date_idx" ON "forex_rates" USING btree ("currency","effective_date");--> statement-breakpoint
CREATE INDEX "hs_codes_code_idx" ON "hs_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "hs_codes_category_idx" ON "hs_codes" USING btree ("category_id","is_active");