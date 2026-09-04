import { db } from "./index.js";
import {
  branches, countries, ports, commodityCategories, hsCodes,
  forexRates, systemConfigs, users,
} from "./schema/index.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

async function seed() {
  logger.info("Starting database seed...");

  // 1. Branches
  logger.info("Seeding branches...");
  const branchData = [
    { code: "ADD", name_en: "Bole International Airport", name_am: "ቦሌ ዓለም አቀፍ አውሮፕላን ማረፊያ", city: "Addis Ababa", region: "Addis Ababa" },
    { code: "ADP", name_en: "Passenger Terminal", name_am: "የ yolovLe ጉብኝት", city: "Addis Ababa", region: "Addis Ababa" },
    { code: "KAL", name_en: "Kality Dry Port", name_am: "ቃሊቲ ድራይ ፖርት", city: "Addis Ababa", region: "Addis Ababa" },
    { code: "DRM", name_en: "Dire Dawa Customs Branch", name_am: "ድሬ ዳዋ የ customs ክፍል", city: "Dire Dawa", region: "Dire Dawa" },
    { code: "BDR", name_en: "Bahir Dar Customs Branch", name_am: "ባሕር ዳር የ customs ክፍል", city: "Bahir Dar", region: "Amhara" },
    { code: "MKL", name_en: "Mekelle Customs Branch", name_am: "መቀሌ የ customs ክፍል", city: "Mekelle", region: "Tigray" },
    { code: "JIM", name_en: "Jimma Customs Branch", name_am: "ጅማ የ customs ክፍል", city: "Jimma", region: "Oromia" },
    { code: "ASM", name_en: "Assab Corridor Office", name_am: "አሳብ ቆሮዳር ቢሮ", city: "Assab", region: "SNNPR" },
  ];
  await db.insert(branches).values(branchData).onConflictDoNothing();

  // 2. Countries
  logger.info("Seeding countries...");
  const countryData = [
    { code: "CHN", name_en: "China", name_am: "ቻይና", region: "Asia" },
    { code: "USA", name_en: "United States", name_am: "አሜሪካ", region: "North America" },
    { code: "IND", name_en: "India", name_am: "ህንድ", region: "Asia" },
    { code: "TUR", name_en: "Turkey", name_am: "ቱርክ", region: "Europe/Asia" },
    { code: "SAU", name_en: "Saudi Arabia", name_am: "ሳודי አረቢያ", region: "Middle East" },
    { code: "ARE", name_en: "United Arab Emirates", name_am: "የ አብያን አምራት", region: "Middle East" },
    { code: "DEU", name_en: "Germany", name_am: "ጀርመን", region: "Europe" },
    { code: "JPN", name_en: "Japan", name_am: "ጃፓን", region: "Asia" },
    { code: "KOR", name_en: "South Korea", name_am: "ደቡብ ኮሪያ", region: "Asia" },
    { code: "GBR", name_en: "United Kingdom", name_am: "ዩናይትድ ኪንግደም", region: "Europe" },
    { code: "ITA", name_en: "Italy", name_am: "ጣሊያን", region: "Europe" },
    { code: "NLD", name_en: "Netherlands", name_am: "નેદરላን૭", region: "Europe" },
  ];
  await db.insert(countries).values(countryData).onConflictDoNothing();

  // 3. Ports
  logger.info("Seeding ports...");
  const branchRows = await db.select({ id: branches.id, code: branches.code }).from(branches);
  const branchMap = new Map(branchRows.map(b => [b.code, b.id]));

  const portData = [
    { code: "ADD", name_en: "Bole International Airport", type: "AIRPORT", city: "Addis Ababa", branch_id: branchMap.get("ADD") },
    { code: "JIM", name_en: "Djibouti Corridor Dry Port", type: "DRY_PORT", city: "Addis Ababa", branch_id: branchMap.get("KAL") },
    { code: "MAS", name_en: "Mekelle Dry Port", type: "DRY_PORT", city: "Mekelle", branch_id: branchMap.get("MKL") },
    { code: "ASS", name_en: "Assab Land Border", type: "LAND_BORDER", city: "Assab", branch_id: branchMap.get("ASM") },
  ];
  await db.insert(ports).values(portData).onConflictDoNothing();

  // 4. Commodity Categories (top-level chapters)
  logger.info("Seeding commodity categories...");
  const categoryData = [
    { code: "01-05", name_en: "Live Animals and Animal Products", level: 0, sort_order: 1 },
    { code: "06-14", name_en: "Vegetable Products", level: 0, sort_order: 2 },
    { code: "15", name_en: "Fats and Oils", level: 0, sort_order: 3 },
    { code: "16-24", name_en: "Foodstuffs, Beverages, Tobacco", level: 0, sort_order: 4 },
    { code: "25-27", name_en: "Mineral Products", level: 0, sort_order: 5 },
    { code: "28-38", name_en: "Chemicals and Allied Industries", level: 0, sort_order: 6 },
    { code: "39-40", name_en: "Plastics and Rubber", level: 0, sort_order: 7 },
    { code: "41-43", name_en: "Raw Hides, Skins, Leather", level: 0, sort_order: 8 },
    { code: "44-49", name_en: "Wood and Wood Products", level: 0, sort_order: 9 },
    { code: "50-63", name_en: "Textiles and Textile Articles", level: 0, sort_order: 10 },
    { code: "64-67", name_en: "Footwear, Headgear", level: 0, sort_order: 11 },
    { code: "68-70", name_en: "Stone, Ceramic, Glass", level: 0, sort_order: 12 },
    { code: "71", name_en: "Precious Stones, Jewelry", level: 0, sort_order: 13 },
    { code: "72-83", name_en: "Base Metals and Articles", level: 0, sort_order: 14 },
    { code: "84-85", name_en: "Machinery and Electrical Equipment", level: 0, sort_order: 15 },
    { code: "86-89", name_en: "Vehicles, Aircraft, Vessels", level: 0, sort_order: 16 },
    { code: "90-92", name_en: "Optical, Medical, Musical Instruments", level: 0, sort_order: 17 },
    { code: "93", name_en: "Arms and Ammunition", level: 0, sort_order: 18 },
    { code: "94-96", name_en: "Miscellaneous Manufactured Articles", level: 0, sort_order: 19 },
  ];
  await db.insert(commodityCategories).values(categoryData).onConflictDoNothing();

  // 5. HS Codes
  logger.info("Seeding HS codes...");
  const hsData = [
    { code: "8517.13.00", description_en: "Smartphones", unit_of_measurement: "U", duty_rate: "0.05", excise_rate: "0.00", is_exempt_eligible: false },
    { code: "8703.23.90", description_en: "SUV Vehicles (1500cc-3000cc)", unit_of_measurement: "U", duty_rate: "0.35", excise_rate: "0.30", is_exempt_eligible: false },
    { code: "0201.30.00", description_en: "Fresh Beef, Boneless", unit_of_measurement: "KG", duty_rate: "0.20", excise_rate: "0.00", is_exempt_eligible: false },
    { code: "3004.90.00", description_en: "Medicaments (mixed or unmixed)", unit_of_measurement: "KG", duty_rate: "0.00", excise_rate: "0.00", is_exempt_eligible: true, vat_rate: "0.15", surtax_rate: "0.00" },
    { code: "1001.19.00", description_en: "Durum Wheat Seed", unit_of_measurement: "KG", duty_rate: "0.00", excise_rate: "0.00", is_exempt_eligible: true, surtax_rate: "0.00" },
    { code: "8471.30.00", description_en: "Laptop Computers", unit_of_measurement: "U", duty_rate: "0.05", excise_rate: "0.00", is_exempt_eligible: false },
    { code: "6110.30.00", description_en: "Synthetic Textile Garments", unit_of_measurement: "U", duty_rate: "0.20", excise_rate: "0.00", is_exempt_eligible: false },
    { code: "2201.10.00", description_en: "Mineral Water (unsweetened)", unit_of_measurement: "L", duty_rate: "0.10", excise_rate: "0.10", is_exempt_eligible: false },
  ];
  await db.insert(hsCodes).values(hsData).onConflictDoNothing();

  // 6. Default Super Admin (create before forex which references it)
  logger.info("Creating default super admin...");
  const passwordHash = await bcrypt.hash("Admin@123", 12);
  await db.insert(users).values({
    email: "admin@customs.gov.et",
    password_hash: passwordHash,
    full_name: "System Administrator",
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    branch_id: branchMap.get("ADD"),
    password_changed_at: new Date(),
  }).onConflictDoNothing();

  const tariffUsers = await db.select({ id: users.id }).from(users).where(
    eq(users.role, "SUPER_ADMIN")
  ).limit(1);
  const adminUserId = tariffUsers[0]?.id;
  if (adminUserId) {
    const today = new Date().toISOString().split("T")[0];
    const forexData = [
      { currency: "USD", exchange_rate_to_etb: "57.50", effective_date: today, set_by_user_id: adminUserId },
      { currency: "EUR", exchange_rate_to_etb: "62.80", effective_date: today, set_by_user_id: adminUserId },
      { currency: "GBP", exchange_rate_to_etb: "73.20", effective_date: today, set_by_user_id: adminUserId },
      { currency: "AED", exchange_rate_to_etb: "15.65", effective_date: today, set_by_user_id: adminUserId },
      { currency: "CNY", exchange_rate_to_etb: "7.95", effective_date: today, set_by_user_id: adminUserId },
      { currency: "CAD", exchange_rate_to_etb: "42.10", effective_date: today, set_by_user_id: adminUserId },
      { currency: "INR", exchange_rate_to_etb: "0.68", effective_date: today, set_by_user_id: adminUserId },
      { currency: "SAR", exchange_rate_to_etb: "15.33", effective_date: today, set_by_user_id: adminUserId },
      { currency: "TRY", exchange_rate_to_etb: "1.72", effective_date: today, set_by_user_id: adminUserId },
      { currency: "JPY", exchange_rate_to_etb: "0.39", effective_date: today, set_by_user_id: adminUserId },
    ];
    await db.insert(forexRates).values(forexData).onConflictDoNothing();
  }

  // 7. System Configs
  logger.info("Seeding system configs...");
  const configData = [
    { config_key: "SCAN_FEE_ETB", config_value: "200", value_type: "NUMBER", description: "Flat scanning/admin fee in ETB" },
    { config_key: "DRAFT_EXPIRY_HOURS", config_value: "48", value_type: "NUMBER", description: "Hours before draft expires" },
    { config_key: "MAX_LOGIN_ATTEMPTS", config_value: "5", value_type: "NUMBER", description: "Failed attempts before lockout" },
    { config_key: "LOCKOUT_MINUTES", config_value: "15", value_type: "NUMBER", description: "Lockout duration in minutes" },
    { config_key: "ACCESS_TOKEN_EXPIRY_MIN", config_value: "15", value_type: "NUMBER", description: "Access token lifetime in minutes" },
    { config_key: "REFRESH_TOKEN_EXPIRY_DAYS", config_value: "7", value_type: "NUMBER", description: "Refresh token lifetime in days" },
    { config_key: "QR_TOKEN_EXPIRY_DAYS", config_value: "365", value_type: "NUMBER", description: "QR verification validity in days" },
    { config_key: "SYSTEM_NAME", config_value: "CustomsDuty Pro", value_type: "STRING", description: "System display name", is_public: true },
    { config_key: "SYSTEM_VERSION", config_value: "1.0.0", value_type: "STRING", description: "Current version", is_public: true },
    { config_key: "MAINTENANCE_MODE", config_value: "false", value_type: "BOOLEAN", description: "Maintenance mode toggle" },
    { config_key: "MAX_ITEMS_PER_ASSESSMENT", config_value: "50", value_type: "NUMBER", description: "Max line items per assessment" },
    { config_key: "DEFAULT_CURRENCY", config_value: "USD", value_type: "STRING", description: "Default currency", is_public: true },
  ];
  await db.insert(systemConfigs).values(configData).onConflictDoNothing();

  logger.info("Seed completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  logger.error("Seed failed", { error: err.message });
  process.exit(1);
});
