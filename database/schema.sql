-- =====================================================================
--  Doctor Management System (Veterinary) - MySQL schema
--  Run this whole file once in MySQL Workbench:
--     File > Open SQL Script > select this file > click the lightning bolt
--  It creates the database and every table. No sample data is inserted.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS vet_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vet_management;

-- ---------------------------------------------------------------------
-- Doctors (login + profile)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(120)  NOT NULL,
  email            VARCHAR(150)  NOT NULL,
  password_hash    VARCHAR(255)  NOT NULL,
  phone            VARCHAR(20)   NOT NULL,
  qualification    VARCHAR(150)  NULL,
  specialization   VARCHAR(120)  NULL,
  experience_years TINYINT UNSIGNED NULL,
  clinic_name      VARCHAR(150)  NULL,
  clinic_address   VARCHAR(255)  NULL,
  address          VARCHAR(255)  NULL,
  profile_image    VARCHAR(255)  NULL,
  last_login       DATETIME      NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctors_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Forgot-password tokens (only the SHA-256 hash of the token is stored)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id   INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pr_token (token_hash),
  CONSTRAINT fk_pr_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Logged-out JWTs (so a token stops working after logout)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_blocklist (
  jti         CHAR(36)  NOT NULL,
  expires_at  DATETIME  NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (jti),
  KEY idx_tb_expires (expires_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Patients (a pet + its owner)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id      INT UNSIGNED NOT NULL,
  owner_name     VARCHAR(120) NOT NULL,
  owner_phone    VARCHAR(20)  NOT NULL,
  owner_email    VARCHAR(150) NULL,
  owner_address  VARCHAR(255) NULL,
  pet_name       VARCHAR(100) NOT NULL,
  species        VARCHAR(50)  NOT NULL,
  breed          VARCHAR(100) NULL,
  age            DECIMAL(4,1) NULL,
  gender         ENUM('Male','Female','Unknown') NOT NULL DEFAULT 'Unknown',
  weight         DECIMAL(6,2) NULL,
  blood_group    VARCHAR(20)  NULL,
  image          VARCHAR(255) NULL,
  notes          TEXT         NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_patients_doctor (doctor_id),
  KEY idx_patients_pet (pet_name),
  KEY idx_patients_owner (owner_name),
  CONSTRAINT fk_patients_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Medical history entries per patient
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medical_history (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id   INT UNSIGNED NOT NULL,
  title        VARCHAR(150) NOT NULL,
  description  TEXT         NULL,
  recorded_on  DATE         NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mh_patient (patient_id),
  CONSTRAINT fk_mh_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vaccinations per patient
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vaccinations (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id    INT UNSIGNED NOT NULL,
  vaccine_name  VARCHAR(150) NOT NULL,
  given_on      DATE         NOT NULL,
  next_due_on   DATE         NULL,
  notes         VARCHAR(255) NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vac_patient (patient_id),
  CONSTRAINT fk_vac_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id         INT UNSIGNED NOT NULL,
  patient_id        INT UNSIGNED NOT NULL,
  appointment_date  DATE         NOT NULL,
  appointment_time  TIME         NOT NULL,
  reason            VARCHAR(255) NOT NULL,
  notes             TEXT         NULL,
  visit_type        ENUM('Clinic','Home Visit','Video Consultation','Emergency') NOT NULL DEFAULT 'Clinic',
  status            ENUM('Waiting','Confirmed','In Consultation','Completed','Cancelled') NOT NULL DEFAULT 'Waiting',
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appt_doctor_date (doctor_id, appointment_date),
  KEY idx_appt_patient (patient_id),
  KEY idx_appt_status (status),
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON DELETE CASCADE,
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Prescriptions (header) + medicines (one row per medicine)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prescriptions (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  doctor_id       INT UNSIGNED NOT NULL,
  patient_id      INT UNSIGNED NOT NULL,
  appointment_id  INT UNSIGNED NULL,
  diagnosis       VARCHAR(255) NOT NULL,
  notes           TEXT         NULL,
  prescribed_on   DATE         NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rx_doctor_date (doctor_id, prescribed_on),
  KEY idx_rx_patient (patient_id),
  CONSTRAINT fk_rx_doctor  FOREIGN KEY (doctor_id)      REFERENCES doctors (id)      ON DELETE CASCADE,
  CONSTRAINT fk_rx_patient FOREIGN KEY (patient_id)     REFERENCES patients (id)     ON DELETE CASCADE,
  CONSTRAINT fk_rx_appt    FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescription_medicines (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  prescription_id  INT UNSIGNED NOT NULL,
  medicine_name    VARCHAR(150) NOT NULL,
  dosage           VARCHAR(100) NULL,
  frequency        VARCHAR(100) NULL,
  duration         VARCHAR(100) NULL,
  instructions     VARCHAR(255) NULL,
  sort_order       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_rxm_rx (prescription_id),
  KEY idx_rxm_name (medicine_name),
  CONSTRAINT fk_rxm_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions (id) ON DELETE CASCADE
) ENGINE=InnoDB;
