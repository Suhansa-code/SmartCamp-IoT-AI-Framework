# Rejected datasets

These files were downloaded during data collection, assessed for the Sri Lanka
resource model, and **excluded from the training set**. They are kept here so the
assessment is auditable rather than invisible.

## cleaned_global_water_consumption.csv

- **Content:** national annual water statistics, 20 countries, 2000–2024, 500 rows.
- **Reason for rejection:** contains **zero Sri Lanka rows**. The 20 countries are
  Argentina, Australia, Brazil, Canada, China, France, Germany, India, Indonesia,
  Italy, Japan, Mexico, Russia, Saudi Arabia, South Africa, South Korea, Spain,
  Turkey, UK and USA. There is no Sri Lankan value to extract at any granularity.
- **Secondary reason:** even for a country it does cover, the granularity is
  national per-capita annual consumption, which is not a camp ration figure.

## reach_car_msna_2025_table_d_analyses.xlsx

- **Content:** REACH Multi-Sector Needs Assessment household survey, 2025.
- **Reason for rejection:** this is a **Central African Republic** survey, not a
  Sri Lankan one (`car` in the filename is the CAR country code). The instrument
  is in French and the geography is CAR prefectures — the file contains 30
  references to Ouham and 9 to Bangui, and zero to Sri Lanka.
- **Note on the file itself:** it was committed with a `.csv` extension but is
  actually an XLSX workbook. It has been renamed to `.xlsx` here so it is not
  mistaken for a parseable Sri Lankan CSV.

## Why this matters for the model

The panel's comment was that training data must be demonstrably Sri Lanka
relevant. Both files fail that test on country coverage alone, so neither
contributes a feature, a target, or a rate constant to the current model.
