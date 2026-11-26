-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: jewellers_crm
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `account_groups`
--

DROP TABLE IF EXISTS `account_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `account_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `parent_id` int(10) unsigned DEFAULT NULL,
  `nature` enum('asset','liability','income','expense') NOT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_account_groups_parent` (`parent_id`),
  CONSTRAINT `fk_account_groups_parent` FOREIGN KEY (`parent_id`) REFERENCES `account_groups` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account_groups`
--

LOCK TABLES `account_groups` WRITE;
/*!40000 ALTER TABLE `account_groups` DISABLE KEYS */;
INSERT INTO `account_groups` VALUES (1,'Assets',NULL,'asset',1,1,'2026-08-01 09:51:17'),(2,'Liabilities',NULL,'liability',1,2,'2026-08-01 09:51:17'),(3,'Income',NULL,'income',1,3,'2026-08-01 09:51:17'),(4,'Expenses',NULL,'expense',1,4,'2026-08-01 09:51:17'),(5,'Cash & Bank',1,'asset',1,1,'2026-08-01 09:51:17'),(6,'Inventory',1,'asset',1,2,'2026-08-01 09:51:17'),(7,'Accounts Receivable',1,'asset',1,3,'2026-08-01 09:51:17'),(8,'Tax Assets',1,'asset',1,4,'2026-08-01 09:51:17'),(9,'Accounts Payable',2,'liability',1,1,'2026-08-01 09:51:17'),(10,'Tax Liabilities',2,'liability',1,2,'2026-08-01 09:51:17'),(11,'Opening Balances',2,'liability',1,3,'2026-08-01 09:51:17'),(12,'Sales',3,'income',1,1,'2026-08-01 09:51:17'),(13,'Other Income',3,'income',1,2,'2026-08-01 09:51:17'),(14,'Cost of Goods Sold',4,'expense',1,1,'2026-08-01 09:51:17'),(15,'Operating Expenses',4,'expense',1,2,'2026-08-01 09:51:17');
/*!40000 ALTER TABLE `account_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `api_rate_limits`
--

DROP TABLE IF EXISTS `api_rate_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `api_rate_limits` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `rate_key` char(64) NOT NULL,
  `bucket` varchar(60) NOT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `window_started_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rate_key` (`rate_key`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `api_rate_limits`
--

LOCK TABLES `api_rate_limits` WRITE;
/*!40000 ALTER TABLE `api_rate_limits` DISABLE KEYS */;
/*!40000 ALTER TABLE `api_rate_limits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(80) DEFAULT NULL,
  `entity_id` int(10) unsigned DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=246 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-02\",\"rate\":7372.96}','0.0.0.0','2026-08-01 09:51:17'),(2,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-02\",\"rate\":6988.24}','0.0.0.0','2026-08-01 09:51:17'),(3,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-02\",\"rate\":5604.05}','0.0.0.0','2026-08-01 09:51:17'),(4,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-02\",\"rate\":99.85}','0.0.0.0','2026-08-01 09:51:17'),(5,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-02\",\"rate\":92.92}','0.0.0.0','2026-08-01 09:51:17'),(6,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-03\",\"rate\":7354.14}','0.0.0.0','2026-08-01 09:51:17'),(7,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-03\",\"rate\":6970.4}','0.0.0.0','2026-08-01 09:51:17'),(8,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-03\",\"rate\":5589.75}','0.0.0.0','2026-08-01 09:51:17'),(9,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-03\",\"rate\":99.59}','0.0.0.0','2026-08-01 09:51:17'),(10,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-03\",\"rate\":92.68}','0.0.0.0','2026-08-01 09:51:17'),(11,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-04\",\"rate\":7334.63}','0.0.0.0','2026-08-01 09:51:17'),(12,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-04\",\"rate\":6951.91}','0.0.0.0','2026-08-01 09:51:17'),(13,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-04\",\"rate\":5574.92}','0.0.0.0','2026-08-01 09:51:17'),(14,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-04\",\"rate\":99.33}','0.0.0.0','2026-08-01 09:51:17'),(15,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-04\",\"rate\":92.43}','0.0.0.0','2026-08-01 09:51:17'),(16,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-05\",\"rate\":7315.39}','0.0.0.0','2026-08-01 09:51:17'),(17,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-05\",\"rate\":6933.67}','0.0.0.0','2026-08-01 09:51:17'),(18,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-05\",\"rate\":5560.29}','0.0.0.0','2026-08-01 09:51:17'),(19,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-05\",\"rate\":99.07}','0.0.0.0','2026-08-01 09:51:17'),(20,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-05\",\"rate\":92.19}','0.0.0.0','2026-08-01 09:51:17'),(21,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-06\",\"rate\":7297.35}','0.0.0.0','2026-08-01 09:51:17'),(22,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-06\",\"rate\":6916.58}','0.0.0.0','2026-08-01 09:51:17'),(23,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-06\",\"rate\":5546.59}','0.0.0.0','2026-08-01 09:51:17'),(24,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-06\",\"rate\":98.82}','0.0.0.0','2026-08-01 09:51:17'),(25,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-06\",\"rate\":91.96}','0.0.0.0','2026-08-01 09:51:17'),(26,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-07\",\"rate\":7281.42}','0.0.0.0','2026-08-01 09:51:17'),(27,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-07\",\"rate\":6901.47}','0.0.0.0','2026-08-01 09:51:17'),(28,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-07\",\"rate\":5534.47}','0.0.0.0','2026-08-01 09:51:17'),(29,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-07\",\"rate\":98.61}','0.0.0.0','2026-08-01 09:51:17'),(30,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-07\",\"rate\":91.76}','0.0.0.0','2026-08-01 09:51:17'),(31,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-08\",\"rate\":7268.36}','0.0.0.0','2026-08-01 09:51:17'),(32,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-08\",\"rate\":6889.1}','0.0.0.0','2026-08-01 09:51:17'),(33,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-08\",\"rate\":5524.55}','0.0.0.0','2026-08-01 09:51:17'),(34,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-08\",\"rate\":98.43}','0.0.0.0','2026-08-01 09:51:17'),(35,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-08\",\"rate\":91.6}','0.0.0.0','2026-08-01 09:51:17'),(36,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-09\",\"rate\":7258.83}','0.0.0.0','2026-08-01 09:51:17'),(37,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-09\",\"rate\":6880.06}','0.0.0.0','2026-08-01 09:51:17'),(38,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-09\",\"rate\":5517.3}','0.0.0.0','2026-08-01 09:51:17'),(39,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-09\",\"rate\":98.3}','0.0.0.0','2026-08-01 09:51:17'),(40,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-09\",\"rate\":91.48}','0.0.0.0','2026-08-01 09:51:17'),(41,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-10\",\"rate\":7253.29}','0.0.0.0','2026-08-01 09:51:17'),(42,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-10\",\"rate\":6874.81}','0.0.0.0','2026-08-01 09:51:17'),(43,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-10\",\"rate\":5513.09}','0.0.0.0','2026-08-01 09:51:17'),(44,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-10\",\"rate\":98.23}','0.0.0.0','2026-08-01 09:51:17'),(45,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-10\",\"rate\":91.41}','0.0.0.0','2026-08-01 09:51:17'),(46,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-11\",\"rate\":7252.01}','0.0.0.0','2026-08-01 09:51:17'),(47,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-11\",\"rate\":6873.6}','0.0.0.0','2026-08-01 09:51:17'),(48,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-11\",\"rate\":5512.12}','0.0.0.0','2026-08-01 09:51:17'),(49,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-11\",\"rate\":98.21}','0.0.0.0','2026-08-01 09:51:17'),(50,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-11\",\"rate\":91.39}','0.0.0.0','2026-08-01 09:51:17'),(51,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-12\",\"rate\":7255.06}','0.0.0.0','2026-08-01 09:51:17'),(52,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-12\",\"rate\":6876.49}','0.0.0.0','2026-08-01 09:51:17'),(53,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-12\",\"rate\":5514.44}','0.0.0.0','2026-08-01 09:51:17'),(54,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-12\",\"rate\":98.25}','0.0.0.0','2026-08-01 09:51:17'),(55,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-12\",\"rate\":91.43}','0.0.0.0','2026-08-01 09:51:17'),(56,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-13\",\"rate\":7262.29}','0.0.0.0','2026-08-01 09:51:17'),(57,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-13\",\"rate\":6883.35}','0.0.0.0','2026-08-01 09:51:17'),(58,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-13\",\"rate\":5519.93}','0.0.0.0','2026-08-01 09:51:17'),(59,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-13\",\"rate\":98.35}','0.0.0.0','2026-08-01 09:51:17'),(60,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-13\",\"rate\":91.52}','0.0.0.0','2026-08-01 09:51:17'),(61,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-14\",\"rate\":7273.34}','0.0.0.0','2026-08-01 09:51:17'),(62,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-14\",\"rate\":6893.82}','0.0.0.0','2026-08-01 09:51:17'),(63,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-14\",\"rate\":5528.33}','0.0.0.0','2026-08-01 09:51:17'),(64,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-14\",\"rate\":98.5}','0.0.0.0','2026-08-01 09:51:17'),(65,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-14\",\"rate\":91.66}','0.0.0.0','2026-08-01 09:51:17'),(66,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-15\",\"rate\":7287.67}','0.0.0.0','2026-08-01 09:51:17'),(67,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-15\",\"rate\":6907.4}','0.0.0.0','2026-08-01 09:51:17'),(68,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-15\",\"rate\":5539.22}','0.0.0.0','2026-08-01 09:51:17'),(69,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-15\",\"rate\":98.69}','0.0.0.0','2026-08-01 09:51:17'),(70,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-15\",\"rate\":91.84}','0.0.0.0','2026-08-01 09:51:17'),(71,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-16\",\"rate\":7304.57}','0.0.0.0','2026-08-01 09:51:17'),(72,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-16\",\"rate\":6923.42}','0.0.0.0','2026-08-01 09:51:17'),(73,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-16\",\"rate\":5552.07}','0.0.0.0','2026-08-01 09:51:17'),(74,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-16\",\"rate\":98.92}','0.0.0.0','2026-08-01 09:51:17'),(75,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-16\",\"rate\":92.05}','0.0.0.0','2026-08-01 09:51:17'),(76,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-17\",\"rate\":7323.21}','0.0.0.0','2026-08-01 09:51:17'),(77,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-17\",\"rate\":6941.09}','0.0.0.0','2026-08-01 09:51:17'),(78,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-17\",\"rate\":5566.24}','0.0.0.0','2026-08-01 09:51:17'),(79,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-17\",\"rate\":99.17}','0.0.0.0','2026-08-01 09:51:17'),(80,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-17\",\"rate\":92.29}','0.0.0.0','2026-08-01 09:51:17'),(81,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-18\",\"rate\":7342.68}','0.0.0.0','2026-08-01 09:51:17'),(82,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-18\",\"rate\":6959.54}','0.0.0.0','2026-08-01 09:51:17'),(83,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-18\",\"rate\":5581.04}','0.0.0.0','2026-08-01 09:51:17'),(84,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-18\",\"rate\":99.44}','0.0.0.0','2026-08-01 09:51:17'),(85,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-18\",\"rate\":92.53}','0.0.0.0','2026-08-01 09:51:17'),(86,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-19\",\"rate\":7362.02}','0.0.0.0','2026-08-01 09:51:17'),(87,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-19\",\"rate\":6977.87}','0.0.0.0','2026-08-01 09:51:17'),(88,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-19\",\"rate\":5595.74}','0.0.0.0','2026-08-01 09:51:17'),(89,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-19\",\"rate\":99.7}','0.0.0.0','2026-08-01 09:51:17'),(90,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-19\",\"rate\":92.78}','0.0.0.0','2026-08-01 09:51:17'),(91,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-20\",\"rate\":7380.28}','0.0.0.0','2026-08-01 09:51:17'),(92,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-20\",\"rate\":6995.17}','0.0.0.0','2026-08-01 09:51:17'),(93,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-20\",\"rate\":5609.61}','0.0.0.0','2026-08-01 09:51:17'),(94,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-20\",\"rate\":99.95}','0.0.0.0','2026-08-01 09:51:17'),(95,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-20\",\"rate\":93.01}','0.0.0.0','2026-08-01 09:51:17'),(96,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-21\",\"rate\":7396.55}','0.0.0.0','2026-08-01 09:51:17'),(97,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-21\",\"rate\":7010.6}','0.0.0.0','2026-08-01 09:51:17'),(98,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-21\",\"rate\":5621.98}','0.0.0.0','2026-08-01 09:51:17'),(99,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-21\",\"rate\":100.17}','0.0.0.0','2026-08-01 09:51:17'),(100,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-21\",\"rate\":93.21}','0.0.0.0','2026-08-01 09:51:17'),(101,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-22\",\"rate\":7410.04}','0.0.0.0','2026-08-01 09:51:17'),(102,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-22\",\"rate\":7023.39}','0.0.0.0','2026-08-01 09:51:17'),(103,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-22\",\"rate\":5632.24}','0.0.0.0','2026-08-01 09:51:17'),(104,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-22\",\"rate\":100.35}','0.0.0.0','2026-08-01 09:51:17'),(105,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-22\",\"rate\":93.38}','0.0.0.0','2026-08-01 09:51:17'),(106,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-23\",\"rate\":7420.09}','0.0.0.0','2026-08-01 09:51:17'),(107,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-23\",\"rate\":7032.91}','0.0.0.0','2026-08-01 09:51:17'),(108,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-23\",\"rate\":5639.88}','0.0.0.0','2026-08-01 09:51:17'),(109,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-23\",\"rate\":100.48}','0.0.0.0','2026-08-01 09:51:17'),(110,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-23\",\"rate\":93.51}','0.0.0.0','2026-08-01 09:51:17'),(111,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-24\",\"rate\":7426.2}','0.0.0.0','2026-08-01 09:51:17'),(112,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-24\",\"rate\":7038.7}','0.0.0.0','2026-08-01 09:51:17'),(113,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-24\",\"rate\":5644.52}','0.0.0.0','2026-08-01 09:51:17'),(114,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-24\",\"rate\":100.57}','0.0.0.0','2026-08-01 09:51:17'),(115,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-24\",\"rate\":93.59}','0.0.0.0','2026-08-01 09:51:17'),(116,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-25\",\"rate\":7428.07}','0.0.0.0','2026-08-01 09:51:17'),(117,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-25\",\"rate\":7040.47}','0.0.0.0','2026-08-01 09:51:17'),(118,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-25\",\"rate\":5645.94}','0.0.0.0','2026-08-01 09:51:17'),(119,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-25\",\"rate\":100.59}','0.0.0.0','2026-08-01 09:51:17'),(120,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-25\",\"rate\":93.61}','0.0.0.0','2026-08-01 09:51:17'),(121,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-26\",\"rate\":7425.61}','0.0.0.0','2026-08-01 09:51:17'),(122,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-26\",\"rate\":7038.14}','0.0.0.0','2026-08-01 09:51:17'),(123,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-26\",\"rate\":5644.07}','0.0.0.0','2026-08-01 09:51:17'),(124,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-26\",\"rate\":100.56}','0.0.0.0','2026-08-01 09:51:17'),(125,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-26\",\"rate\":93.58}','0.0.0.0','2026-08-01 09:51:17'),(126,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-27\",\"rate\":7418.94}','0.0.0.0','2026-08-01 09:51:17'),(127,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-27\",\"rate\":7031.82}','0.0.0.0','2026-08-01 09:51:17'),(128,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-27\",\"rate\":5639}','0.0.0.0','2026-08-01 09:51:17'),(129,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-27\",\"rate\":100.47}','0.0.0.0','2026-08-01 09:51:17'),(130,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-27\",\"rate\":93.49}','0.0.0.0','2026-08-01 09:51:17'),(131,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-28\",\"rate\":7408.38}','0.0.0.0','2026-08-01 09:51:17'),(132,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-28\",\"rate\":7021.81}','0.0.0.0','2026-08-01 09:51:17'),(133,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-28\",\"rate\":5630.98}','0.0.0.0','2026-08-01 09:51:17'),(134,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-28\",\"rate\":100.33}','0.0.0.0','2026-08-01 09:51:17'),(135,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-28\",\"rate\":93.36}','0.0.0.0','2026-08-01 09:51:17'),(136,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-29\",\"rate\":7394.47}','0.0.0.0','2026-08-01 09:51:17'),(137,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-29\",\"rate\":7008.62}','0.0.0.0','2026-08-01 09:51:17'),(138,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-29\",\"rate\":5620.4}','0.0.0.0','2026-08-01 09:51:17'),(139,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-29\",\"rate\":100.14}','0.0.0.0','2026-08-01 09:51:17'),(140,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-29\",\"rate\":93.19}','0.0.0.0','2026-08-01 09:51:17'),(141,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-30\",\"rate\":7377.87}','0.0.0.0','2026-08-01 09:51:17'),(142,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-30\",\"rate\":6992.89}','0.0.0.0','2026-08-01 09:51:17'),(143,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-30\",\"rate\":5607.78}','0.0.0.0','2026-08-01 09:51:17'),(144,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-30\",\"rate\":99.91}','0.0.0.0','2026-08-01 09:51:17'),(145,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-30\",\"rate\":92.98}','0.0.0.0','2026-08-01 09:51:17'),(146,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-07-31\",\"rate\":7359.41}','0.0.0.0','2026-08-01 09:51:17'),(147,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-07-31\",\"rate\":6975.4}','0.0.0.0','2026-08-01 09:51:17'),(148,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-07-31\",\"rate\":5593.76}','0.0.0.0','2026-08-01 09:51:17'),(149,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-07-31\",\"rate\":99.66}','0.0.0.0','2026-08-01 09:51:17'),(150,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-07-31\",\"rate\":92.74}','0.0.0.0','2026-08-01 09:51:17'),(151,1,'rates.set','metal_rates',1,NULL,'{\"date\":\"2026-08-01\",\"rate\":7340}','0.0.0.0','2026-08-01 09:51:17'),(152,1,'rates.set','metal_rates',2,NULL,'{\"date\":\"2026-08-01\",\"rate\":6957}','0.0.0.0','2026-08-01 09:51:17'),(153,1,'rates.set','metal_rates',3,NULL,'{\"date\":\"2026-08-01\",\"rate\":5579}','0.0.0.0','2026-08-01 09:51:17'),(154,1,'rates.set','metal_rates',4,NULL,'{\"date\":\"2026-08-01\",\"rate\":99.4}','0.0.0.0','2026-08-01 09:51:17'),(155,1,'rates.set','metal_rates',5,NULL,'{\"date\":\"2026-08-01\",\"rate\":92.5}','0.0.0.0','2026-08-01 09:51:17'),(156,1,'purchase.create','purchases',1,NULL,'{\"purchase_no\":\"PUR-2627-00001\",\"grand_total\":3732223}','0.0.0.0','2026-08-01 09:51:18'),(157,1,'purchase.create','purchases',2,NULL,'{\"purchase_no\":\"PUR-2627-00002\",\"grand_total\":910590}','0.0.0.0','2026-08-01 09:51:18'),(158,1,'purchase.create','purchases',3,NULL,'{\"purchase_no\":\"PUR-2627-00003\",\"grand_total\":135958}','0.0.0.0','2026-08-01 09:51:18'),(159,1,'purchase.create','purchases',4,NULL,'{\"purchase_no\":\"PUR-2627-00004\",\"grand_total\":2868577}','0.0.0.0','2026-08-01 09:51:18'),(160,1,'purchase.create','purchases',5,NULL,'{\"purchase_no\":\"PUR-2627-00005\",\"grand_total\":61215}','0.0.0.0','2026-08-01 09:51:18'),(161,1,'payment.vendor','vendor_payments',1,NULL,'{\"payment_no\":\"PAY-2627-00001\",\"amount\":3732223,\"mode\":\"bank\"}','0.0.0.0','2026-08-01 09:51:18'),(162,1,'payment.vendor','vendor_payments',2,NULL,'{\"payment_no\":\"PAY-2627-00002\",\"amount\":546354,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:18'),(163,1,'payment.vendor','vendor_payments',3,NULL,'{\"payment_no\":\"PAY-2627-00003\",\"amount\":2868577,\"mode\":\"bank\"}','0.0.0.0','2026-08-01 09:51:18'),(164,1,'payment.vendor','vendor_payments',4,NULL,'{\"payment_no\":\"PAY-2627-00004\",\"amount\":30607.5,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:18'),(165,1,'payment.receive','invoice_payments',1,NULL,'{\"receipt_no\":\"RCPT-2627-00001\",\"amount\":591907,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:18'),(166,1,'invoice.finalize','invoices',1,NULL,'{\"invoice_no\":\"INV-2627-00001\",\"grand_total\":591907,\"voucher_id\":10}','0.0.0.0','2026-08-01 09:51:18'),(167,1,'payment.receive','invoice_payments',2,NULL,'{\"receipt_no\":\"RCPT-2627-00002\",\"amount\":186761,\"mode\":\"cash\"}','0.0.0.0','2026-08-01 09:51:18'),(168,1,'invoice.finalize','invoices',2,NULL,'{\"invoice_no\":\"INV-2627-00002\",\"grand_total\":186761,\"voucher_id\":12}','0.0.0.0','2026-08-01 09:51:18'),(169,1,'payment.receive','invoice_payments',3,NULL,'{\"receipt_no\":\"RCPT-2627-00003\",\"amount\":346184.1,\"mode\":\"cash\"}','0.0.0.0','2026-08-01 09:51:18'),(170,1,'invoice.finalize','invoices',3,NULL,'{\"invoice_no\":\"INV-2627-00003\",\"grand_total\":769298,\"voucher_id\":14}','0.0.0.0','2026-08-01 09:51:18'),(171,1,'payment.receive','invoice_payments',4,NULL,'{\"receipt_no\":\"RCPT-2627-00004\",\"amount\":230789.4,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:18'),(172,1,'payment.receive','invoice_payments',5,NULL,'{\"receipt_no\":\"RCPT-2627-00005\",\"amount\":387480,\"mode\":\"card\"}','0.0.0.0','2026-08-01 09:51:18'),(173,1,'invoice.finalize','invoices',4,NULL,'{\"invoice_no\":\"INV-2627-00004\",\"grand_total\":387480,\"voucher_id\":17}','0.0.0.0','2026-08-01 09:51:18'),(174,1,'invoice.finalize','invoices',5,NULL,'{\"invoice_no\":\"INV-2627-00005\",\"grand_total\":134632,\"voucher_id\":19}','0.0.0.0','2026-08-01 09:51:18'),(175,1,'payment.receive','invoice_payments',6,NULL,'{\"receipt_no\":\"RCPT-2627-00006\",\"amount\":37304.1,\"mode\":\"bank\"}','0.0.0.0','2026-08-01 09:51:18'),(176,1,'invoice.finalize','invoices',6,NULL,'{\"invoice_no\":\"INV-2627-00006\",\"grand_total\":82898,\"voucher_id\":20}','0.0.0.0','2026-08-01 09:51:18'),(177,1,'payment.receive','invoice_payments',7,NULL,'{\"receipt_no\":\"RCPT-2627-00007\",\"amount\":63433,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:18'),(178,1,'invoice.finalize','invoices',7,NULL,'{\"invoice_no\":\"INV-2627-00007\",\"grand_total\":63433,\"voucher_id\":22}','0.0.0.0','2026-08-01 09:51:18'),(179,1,'payment.receive','invoice_payments',8,NULL,'{\"receipt_no\":\"RCPT-2627-00008\",\"amount\":82021,\"mode\":\"cash\"}','0.0.0.0','2026-08-01 09:51:18'),(180,1,'invoice.finalize','invoices',8,NULL,'{\"invoice_no\":\"INV-2627-00008\",\"grand_total\":82021,\"voucher_id\":24}','0.0.0.0','2026-08-01 09:51:18'),(181,1,'payment.receive','invoice_payments',9,NULL,'{\"receipt_no\":\"RCPT-2627-00009\",\"amount\":75753,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:18'),(182,1,'invoice.finalize','invoices',9,NULL,'{\"invoice_no\":\"INV-2627-00009\",\"grand_total\":75753,\"voucher_id\":26}','0.0.0.0','2026-08-01 09:51:18'),(183,1,'invoice.finalize','invoices',10,NULL,'{\"invoice_no\":\"INV-2627-00010\",\"grand_total\":173159,\"voucher_id\":28}','0.0.0.0','2026-08-01 09:51:19'),(184,1,'payment.receive','invoice_payments',10,NULL,'{\"receipt_no\":\"RCPT-2627-00010\",\"amount\":75963,\"mode\":\"cash\"}','0.0.0.0','2026-08-01 09:51:19'),(185,1,'invoice.finalize','invoices',11,NULL,'{\"invoice_no\":\"INV-2627-00011\",\"grand_total\":75963,\"voucher_id\":29}','0.0.0.0','2026-08-01 09:51:19'),(186,1,'voucher.cancel','vouchers',29,'{\"status\":\"active\"}','{\"status\":\"cancelled\",\"reason\":\"Customer changed their mind — piece returned to stock.\"}','0.0.0.0','2026-08-01 09:51:19'),(187,1,'invoice.cancel','invoices',11,'{\"status\":\"final\"}','{\"status\":\"cancelled\",\"reason\":\"Customer changed their mind — piece returned to stock.\"}','0.0.0.0','2026-08-01 09:51:19'),(188,1,'estimate.cancel','estimates',5,NULL,NULL,'0.0.0.0','2026-08-01 09:51:19'),(189,1,'estimate.convert','estimates',6,NULL,'{\"invoice_id\":15}','0.0.0.0','2026-08-01 09:51:19'),(190,1,'payment.receive','invoice_payments',11,NULL,'{\"receipt_no\":\"RCPT-2627-00011\",\"amount\":170202,\"mode\":\"upi\"}','0.0.0.0','2026-08-01 09:51:19'),(191,1,'invoice.finalize','invoices',15,NULL,'{\"invoice_no\":\"INV-2627-00012\",\"grand_total\":170202,\"voucher_id\":31}','0.0.0.0','2026-08-01 09:51:19'),(192,1,'payment.receive','invoice_payments',12,NULL,'{\"receipt_no\":\"RCPT-2627-00012\",\"amount\":50000,\"mode\":\"bank\"}','0.0.0.0','2026-08-01 09:51:19'),(193,1,'stock.adjust','inventory_items',305,NULL,'{\"direction\":\"out\",\"weight\":3.5,\"reason\":\"Physical count shortage\"}','0.0.0.0','2026-08-01 09:51:19'),(194,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-02\",\"rate\":3360.02}','0.0.0.0','2026-08-01 09:57:56'),(195,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-03\",\"rate\":3351.44}','0.0.0.0','2026-08-01 09:57:56'),(196,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-04\",\"rate\":3342.55}','0.0.0.0','2026-08-01 09:57:56'),(197,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-05\",\"rate\":3333.78}','0.0.0.0','2026-08-01 09:57:56'),(198,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-06\",\"rate\":3325.57}','0.0.0.0','2026-08-01 09:57:56'),(199,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-07\",\"rate\":3318.3}','0.0.0.0','2026-08-01 09:57:56'),(200,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-08\",\"rate\":3312.35}','0.0.0.0','2026-08-01 09:57:56'),(201,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-09\",\"rate\":3308.01}','0.0.0.0','2026-08-01 09:57:56'),(202,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-10\",\"rate\":3305.48}','0.0.0.0','2026-08-01 09:57:56'),(203,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-11\",\"rate\":3304.9}','0.0.0.0','2026-08-01 09:57:56'),(204,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-12\",\"rate\":3306.29}','0.0.0.0','2026-08-01 09:57:56'),(205,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-13\",\"rate\":3309.59}','0.0.0.0','2026-08-01 09:57:56'),(206,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-14\",\"rate\":3314.62}','0.0.0.0','2026-08-01 09:57:56'),(207,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-15\",\"rate\":3321.15}','0.0.0.0','2026-08-01 09:57:56'),(208,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-16\",\"rate\":3328.85}','0.0.0.0','2026-08-01 09:57:56'),(209,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-17\",\"rate\":3337.35}','0.0.0.0','2026-08-01 09:57:56'),(210,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-18\",\"rate\":3346.22}','0.0.0.0','2026-08-01 09:57:56'),(211,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-19\",\"rate\":3355.04}','0.0.0.0','2026-08-01 09:57:56'),(212,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-20\",\"rate\":3363.35}','0.0.0.0','2026-08-01 09:57:56'),(213,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-21\",\"rate\":3370.77}','0.0.0.0','2026-08-01 09:57:56'),(214,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-22\",\"rate\":3376.92}','0.0.0.0','2026-08-01 09:57:56'),(215,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-23\",\"rate\":3381.5}','0.0.0.0','2026-08-01 09:57:56'),(216,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-24\",\"rate\":3384.28}','0.0.0.0','2026-08-01 09:57:56'),(217,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-25\",\"rate\":3385.14}','0.0.0.0','2026-08-01 09:57:56'),(218,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-26\",\"rate\":3384.01}','0.0.0.0','2026-08-01 09:57:56'),(219,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-27\",\"rate\":3380.97}','0.0.0.0','2026-08-01 09:57:56'),(220,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-28\",\"rate\":3376.16}','0.0.0.0','2026-08-01 09:57:56'),(221,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-29\",\"rate\":3369.82}','0.0.0.0','2026-08-01 09:57:56'),(222,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-30\",\"rate\":3362.26}','0.0.0.0','2026-08-01 09:57:56'),(223,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-07-31\",\"rate\":3353.85}','0.0.0.0','2026-08-01 09:57:56'),(224,1,'rates.set','metal_rates',6,NULL,'{\"date\":\"2026-08-01\",\"rate\":3345}','0.0.0.0','2026-08-01 09:57:56'),(225,2,'payment.receive','invoice_payments',13,NULL,'{\"receipt_no\":\"RCPT-2627-00013\",\"amount\":86717,\"mode\":\"cash\"}','::1','2026-08-01 10:02:42'),(226,2,'invoice.finalize','invoices',16,NULL,'{\"invoice_no\":\"INV-2627-00013\",\"grand_total\":86717,\"voucher_id\":49}','::1','2026-08-01 10:02:42'),(227,2,'payment.receive','invoice_payments',14,NULL,'{\"receipt_no\":\"RCPT-2627-00014\",\"amount\":152097,\"mode\":\"upi\"}','::1','2026-08-01 10:07:46'),(228,2,'invoice.finalize','invoices',17,NULL,'{\"invoice_no\":\"INV-2627-00014\",\"grand_total\":152097,\"voucher_id\":51}','::1','2026-08-01 10:07:46'),(229,1,'item.create','inventory_items',329,NULL,'{\"name\":\"demo gold\",\"metal\":\"gold\",\"purity_id\":2,\"tracking\":\"tagged\",\"category_id\":null,\"gross_weight\":100,\"net_weight\":30,\"stone_weight\":70,\"making_type\":\"per_gram\",\"making_value\":70,\"huid\":null,\"hsn_code\":\"7113\",\"barcode\":null}','::1','2026-08-01 10:13:02'),(230,1,'item.update','inventory_items',329,NULL,'{\"name\":\"demo gold\",\"metal\":\"gold\",\"purity_id\":2,\"tracking\":\"tagged\",\"category_id\":null,\"gross_weight\":100,\"net_weight\":30,\"stone_weight\":70,\"making_type\":\"per_gram\",\"making_value\":70,\"huid\":null,\"hsn_code\":\"7113\",\"barcode\":null}','::1','2026-08-01 10:14:16'),(231,1,'payment.receive','invoice_payments',15,NULL,'{\"receipt_no\":\"RCPT-2627-00015\",\"amount\":210810,\"mode\":\"cash\"}','::1','2026-08-01 10:17:07'),(232,1,'invoice.finalize','invoices',18,NULL,'{\"invoice_no\":\"INV-2627-00015\",\"grand_total\":210810,\"voucher_id\":53}','::1','2026-08-01 10:17:07'),(233,2,'purchase.create','purchases',6,NULL,'{\"purchase_no\":\"PUR-2627-00006\",\"grand_total\":151204}','::1','2026-08-01 10:55:29'),(234,2,'payment.vendor','vendor_payments',5,NULL,'{\"payment_no\":\"PAY-2627-00005\",\"amount\":151204,\"mode\":\"cash\"}','::1','2026-08-01 10:55:29'),(235,2,'purchase.create','purchases',7,NULL,'{\"purchase_no\":\"PUR-2627-00007\",\"grand_total\":226806}','::1','2026-08-01 10:56:40'),(236,2,'payment.vendor','vendor_payments',6,NULL,'{\"payment_no\":\"PAY-2627-00006\",\"amount\":226806,\"mode\":\"upi\"}','::1','2026-08-01 10:56:40'),(237,7,'stock.adjust','inventory_items',331,NULL,'{\"direction\":\"in\",\"weight\":100,\"reason\":\"Found during stock count\"}','::1','2026-08-01 10:57:55'),(238,2,'invoice.finalize','invoices',19,NULL,'{\"invoice_no\":\"INV-2627-00016\",\"grand_total\":220200,\"voucher_id\":60}','::1','2026-08-01 10:59:07'),(239,7,'item.create','inventory_items',332,NULL,'{\"name\":\"demo ring\",\"metal\":\"gold\",\"purity_id\":1,\"tracking\":\"tagged\",\"category_id\":null,\"gross_weight\":0,\"net_weight\":0,\"stone_weight\":0,\"making_type\":\"per_gram\",\"making_value\":0,\"huid\":null,\"hsn_code\":\"7113\",\"barcode\":null}','::1','2026-08-01 11:02:26'),(240,7,'stock.adjust','inventory_items',332,NULL,'{\"direction\":\"in\",\"weight\":30,\"reason\":\"Returned by karigar\"}','::1','2026-08-01 11:04:18'),(241,7,'item.update','inventory_items',332,NULL,'{\"name\":\"demo ring\",\"metal\":\"gold\",\"purity_id\":1,\"tracking\":\"tagged\",\"category_id\":null,\"gross_weight\":100,\"net_weight\":30,\"stone_weight\":70,\"making_type\":\"per_gram\",\"making_value\":70,\"huid\":null,\"hsn_code\":\"7113\",\"barcode\":null}','::1','2026-08-01 11:07:10'),(242,7,'item.create','inventory_items',333,NULL,'{\"name\":\"demo gold\",\"metal\":\"gold\",\"purity_id\":1,\"tracking\":\"tagged\",\"category_id\":null,\"gross_weight\":100,\"net_weight\":30,\"stone_weight\":70,\"making_type\":\"per_gram\",\"making_value\":70,\"huid\":null,\"hsn_code\":\"7113\",\"barcode\":null}','::1','2026-08-01 11:08:15'),(243,7,'stock.adjust','inventory_items',333,NULL,'{\"direction\":\"in\",\"weight\":100,\"reason\":\"Found during stock count\"}','::1','2026-08-01 11:08:36'),(244,7,'payment.receive','invoice_payments',16,NULL,'{\"receipt_no\":\"RCPT-2627-00016\",\"amount\":222300,\"mode\":\"cash\"}','::1','2026-08-01 11:10:55'),(245,7,'invoice.finalize','invoices',20,NULL,'{\"invoice_no\":\"INV-2627-00017\",\"grand_total\":222300,\"voucher_id\":62}','::1','2026-08-01 11:10:55');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auth_sessions`
--

DROP TABLE IF EXISTS `auth_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_sessions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `refresh_token_hash` char(64) NOT NULL,
  `previous_refresh_token_hash` char(64) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoke_reason` varchar(60) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_refresh` (`refresh_token_hash`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_prev` (`previous_refresh_token_hash`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auth_sessions`
--

LOCK TABLES `auth_sessions` WRITE;
/*!40000 ALTER TABLE `auth_sessions` DISABLE KEYS */;
INSERT INTO `auth_sessions` VALUES (1,2,'867d25952ca1d072d50781b27f7e8b57d349f0b0f60833d79f137e6f09999dcb','3a526a2dacaec2b59c38c6202ae2b4a66987a031b8652f1f79d23a69b23528fe','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-08-01 16:43:56','refresh_reuse','2026-10-30 15:22:56','2026-08-01 16:43:56','2026-08-01 09:52:56'),(2,7,'b3720939788bfb3aec25dc9f7f29526c0aa45aa2991071e4dcd78199815e9c2e',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,NULL,'2026-10-30 15:23:05',NULL,'2026-08-01 09:53:05'),(3,1,'630313b71061dfe3378f7bbcef4a7954e70d0b46c5c305965836d02d03cc51e4','49b39709915ebc464ed8e05b6b0b540de803fc7cc8c2a73abe7493da72bb2dfe','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','2026-08-01 15:40:35','refresh_reuse','2026-10-30 15:23:15','2026-08-01 15:40:35','2026-08-01 09:53:15'),(4,7,'7212ff1cc069e89ee3c5332b21edda27f6ef12a7a1d1319ba9a055baeb21f51b',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,NULL,'2026-10-30 15:38:16',NULL,'2026-08-01 10:08:16'),(5,1,'00d8d8fe93efe188983cb29492e7f83f409796fc2c44361524ed77ca6eb6e9bb','b1c9f9934f4e36184705ad4c32f565f0bf743f878ba0802686bb68d8f02cf4b6','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,NULL,'2026-10-30 15:40:55','2026-08-01 16:47:09','2026-08-01 10:10:55'),(6,7,'326c390bf3036916b68594a3372b1d4bc9c3944c278bad1a3ac77df0f1d61416',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,NULL,'2026-10-30 16:27:28',NULL,'2026-08-01 10:57:28'),(7,7,'a0f0bd95ad2ce875b6d1a7e793ac7fd8ae9a46a364115464020d0105f59cfb5a',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,NULL,'2026-10-30 16:49:13',NULL,'2026-08-01 11:19:13'),(8,2,'2ff91ee1ce451071b65beed00a4980ce6be3750bbd7d76d81d634cf8f95a07d0',NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,NULL,'2026-10-30 16:49:22',NULL,'2026-08-01 11:19:22');
/*!40000 ALTER TABLE `auth_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_accounts`
--

DROP TABLE IF EXISTS `bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bank_accounts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `account_name` varchar(120) NOT NULL,
  `bank_name` varchar(120) DEFAULT NULL,
  `account_number` varchar(40) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `upi_id` varchar(120) DEFAULT NULL,
  `qr_code_path` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_accounts`
--

LOCK TABLES `bank_accounts` WRITE;
/*!40000 ALTER TABLE `bank_accounts` DISABLE KEYS */;
INSERT INTO `bank_accounts` VALUES (1,'Mahalakshmi Jewellers — Current A/c','HDFC Bank','50200045214521','HDFC0000241','mahalakshmijewellers@hdfcbank',NULL,1,'2026-08-01 09:51:17'),(2,'Savings A/c — Owner','Bank of Maharashtra','60123400778899','MAHB0000123',NULL,NULL,1,'2026-08-01 09:51:17');
/*!40000 ALTER TABLE `bank_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_events`
--

DROP TABLE IF EXISTS `customer_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customer_events` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int(10) unsigned NOT NULL,
  `event_type` varchar(60) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `ref_table` varchar(40) DEFAULT NULL,
  `ref_id` int(10) unsigned DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_events_customer` (`customer_id`),
  KEY `idx_customer_events_created` (`created_at`),
  KEY `fk_customer_events_creator` (`created_by`),
  CONSTRAINT `fk_customer_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customer_events_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_events`
--

LOCK TABLES `customer_events` WRITE;
/*!40000 ALTER TABLE `customer_events` DISABLE KEYS */;
INSERT INTO `customer_events` VALUES (1,1,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(2,2,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(3,3,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(4,4,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(5,5,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(6,6,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(7,7,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(8,8,'created','Customer added.',NULL,NULL,1,'2026-08-01 09:51:17'),(9,9,'created','Customer added.',NULL,NULL,2,'2026-08-01 10:58:25');
/*!40000 ALTER TABLE `customer_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `customers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `customer_code` varchar(20) NOT NULL,
  `name` varchar(150) NOT NULL,
  `company` varchar(150) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `pan_no` varchar(15) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `whatsapp` varchar(20) DEFAULT NULL,
  `alt_mobile` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `opening_type` enum('dr','cr') NOT NULL DEFAULT 'dr',
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `anniversary` date DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `vip` tinyint(1) NOT NULL DEFAULT 0,
  `last_visit_at` datetime DEFAULT NULL,
  `stage` enum('onboarding','active','inactive','churned') NOT NULL DEFAULT 'onboarding',
  `assigned_to` int(10) unsigned DEFAULT NULL,
  `referred_by_customer_id` int(10) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `tags_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags_json`)),
  `opt_in_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`opt_in_json`)),
  `preferences_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferences_json`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers_code` (`customer_code`),
  KEY `idx_customers_stage` (`stage`),
  KEY `idx_customers_mobile` (`mobile`),
  KEY `idx_customers_email` (`email`),
  KEY `idx_customers_assigned` (`assigned_to`),
  KEY `idx_customers_created` (`created_at`),
  KEY `idx_customers_referrer` (`referred_by_customer_id`),
  KEY `fk_customers_creator` (`created_by`),
  CONSTRAINT `fk_customers_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_customers_referrer` FOREIGN KEY (`referred_by_customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES (1,'CUST-0001','Meera Shah',NULL,'27AAJPS1234C1ZQ',NULL,'9820140001',NULL,NULL,'meera.shah@example.com',NULL,0.00,'dr','Mumbai','Maharashtra',NULL,'female','1988-03-12','2012-11-24','Doctor',1,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(2,'CUST-0002','Rohit Mehta',NULL,NULL,NULL,'9820140002',NULL,NULL,NULL,NULL,0.00,'dr','Mumbai','Maharashtra',NULL,'male',NULL,NULL,'Businessman',1,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(3,'CUST-0003','Anita Verma',NULL,NULL,NULL,'9820140003',NULL,NULL,'anita.verma@example.com',NULL,0.00,'dr','Pune','Maharashtra',NULL,'female','1985-06-30',NULL,NULL,0,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(4,'CUST-0004','Priya Nair',NULL,NULL,NULL,'9820140004',NULL,NULL,NULL,NULL,0.00,'dr','Thane','Maharashtra',NULL,'female',NULL,'2016-01-18',NULL,0,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(5,'CUST-0005','Karan Patel',NULL,'24ABCPP7788L1Z3',NULL,'9820140005',NULL,NULL,NULL,NULL,0.00,'dr','Ahmedabad','Gujarat',NULL,'male',NULL,NULL,'Chartered Accountant',0,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(6,'CUST-0006','Sunita Desai',NULL,NULL,NULL,'9820140006',NULL,NULL,NULL,NULL,0.00,'dr','Mumbai','Maharashtra',NULL,'female',NULL,NULL,NULL,0,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(7,'CUST-0007','Vikram Singh',NULL,'07AACPS9911M1Z8',NULL,'9820140007',NULL,NULL,NULL,NULL,0.00,'dr','Delhi','Delhi',NULL,'male',NULL,NULL,NULL,0,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(8,'CUST-0008','Deepa Iyer',NULL,NULL,NULL,'9820140008',NULL,NULL,'deepa.iyer@example.com',NULL,0.00,'dr','Mumbai','Maharashtra',NULL,'female',NULL,NULL,NULL,1,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(9,'CUST-0009','Joy',NULL,NULL,NULL,'9876543210',NULL,NULL,NULL,NULL,0.00,'dr',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,'onboarding',NULL,NULL,NULL,NULL,NULL,NULL,1,2,'2026-08-01 10:58:25','2026-08-01 10:58:25');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimate_items`
--

DROP TABLE IF EXISTS `estimate_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `estimate_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `estimate_id` int(10) unsigned NOT NULL,
  `inventory_item_id` int(10) unsigned DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `purity_code` varchar(10) DEFAULT NULL,
  `qty` decimal(12,3) NOT NULL DEFAULT 1.000,
  `gross_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `net_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rate_per_gram` decimal(12,2) NOT NULL DEFAULT 0.00,
  `metal_value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `making_charge` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_estimate_items_estimate` (`estimate_id`),
  KEY `fk_estimate_items_item` (`inventory_item_id`),
  CONSTRAINT `fk_estimate_items_estimate` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_estimate_items_item` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimate_items`
--

LOCK TABLES `estimate_items` WRITE;
/*!40000 ALTER TABLE `estimate_items` DISABLE KEYS */;
INSERT INTO `estimate_items` VALUES (1,1,NULL,'Bridal necklace set — custom, 22K','22K',1.000,0.000,78.500,6957.00,546124.50,61230.00,0.00,3.00,18220.64,625575.14),(2,1,NULL,'Matching jhumka pair — 22K','22K',1.000,0.000,18.200,6957.00,126617.40,11284.00,0.00,3.00,4137.04,142038.44),(3,2,NULL,'Diamond pendant — 18K, 0.75 ct','18K',1.000,0.000,6.400,5579.00,35705.60,42000.00,0.00,3.00,2331.17,80036.77),(4,3,NULL,'Gents kada — 22K plain','22K',1.000,0.000,38.000,6957.00,264366.00,18240.00,0.00,3.00,8478.18,291084.18),(5,4,NULL,'Mangalsutra — long chain, 22K','22K',1.000,0.000,26.300,6957.00,182969.10,15780.00,0.00,3.00,5962.47,204711.57),(6,5,NULL,'Gold bar 50 g — 999','24K',1.000,0.000,50.000,7340.00,367000.00,1200.00,0.00,3.00,11046.00,379246.00),(7,6,NULL,'Gold chain 22\" — 22K rope','22K',1.000,0.000,22.400,6957.00,155836.80,9408.00,0.00,3.00,4957.34,170202.14);
/*!40000 ALTER TABLE `estimate_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estimates`
--

DROP TABLE IF EXISTS `estimates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `estimates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `estimate_no` varchar(30) NOT NULL,
  `customer_id` int(10) unsigned DEFAULT NULL,
  `walkin_name` varchar(150) DEFAULT NULL,
  `walkin_phone` varchar(20) DEFAULT NULL,
  `estimate_date` date NOT NULL,
  `valid_until` date DEFAULT NULL,
  `price_mode` enum('exclusive','inclusive') NOT NULL DEFAULT 'exclusive',
  `metal_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `making_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_estimate` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` enum('open','converted','expired','cancelled') NOT NULL DEFAULT 'open',
  `converted_invoice_id` int(10) unsigned DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_estimates_no` (`estimate_no`),
  KEY `idx_estimates_customer` (`customer_id`),
  KEY `idx_estimates_status` (`status`,`estimate_date`),
  KEY `fk_estimates_invoice` (`converted_invoice_id`),
  KEY `fk_estimates_creator` (`created_by`),
  CONSTRAINT `fk_estimates_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_estimates_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_estimates_invoice` FOREIGN KEY (`converted_invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estimates`
--

LOCK TABLES `estimates` WRITE;
/*!40000 ALTER TABLE `estimates` DISABLE KEYS */;
INSERT INTO `estimates` VALUES (1,'EST-2627-00001',1,NULL,NULL,'2026-07-31','2026-08-07','exclusive',672741.90,72514.00,0.00,22357.68,767613.58,'open',NULL,'Quotation — rate valid till the date shown.',1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(2,'EST-2627-00002',3,NULL,NULL,'2026-07-30','2026-08-06','exclusive',35705.60,42000.00,0.00,2331.17,80036.77,'open',NULL,'Quotation — rate valid till the date shown.',1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(3,'EST-2627-00003',NULL,'Sanjay Kulkarni','9867221100','2026-07-29','2026-08-05','exclusive',264366.00,18240.00,0.00,8478.18,291084.18,'open',NULL,'Quotation — rate valid till the date shown.',1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(4,'EST-2627-00004',4,NULL,NULL,'2026-07-20','2026-07-27','exclusive',182969.10,15780.00,0.00,5962.47,204711.57,'open',NULL,'Quotation — rate valid till the date shown.',1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(5,'EST-2627-00005',2,NULL,NULL,'2026-07-28','2026-08-04','exclusive',367000.00,1200.00,0.00,11046.00,379246.00,'cancelled',NULL,'Quotation — rate valid till the date shown.',1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(6,'EST-2627-00006',5,NULL,NULL,'2026-07-30','2026-08-06','exclusive',155836.80,9408.00,0.00,4957.34,170202.14,'converted',15,'Quotation — rate valid till the date shown.',1,'2026-08-01 09:51:19','2026-08-01 09:51:19');
/*!40000 ALTER TABLE `estimates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expense_categories`
--

DROP TABLE IF EXISTS `expense_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `expense_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `type` enum('fixed','variable') NOT NULL DEFAULT 'variable',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `system_key` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_categories_name` (`name`),
  UNIQUE KEY `uq_expense_categories_syskey` (`system_key`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expense_categories`
--

LOCK TABLES `expense_categories` WRITE;
/*!40000 ALTER TABLE `expense_categories` DISABLE KEYS */;
INSERT INTO `expense_categories` VALUES (1,'Salaries','fixed',1,1,'SALARY','2026-08-01 09:51:17'),(2,'Inventory Purchase','variable',1,1,'INVENTORY_PURCHASE','2026-08-01 09:51:17'),(3,'Rent','fixed',1,0,NULL,'2026-08-01 09:51:17'),(4,'Utilities','fixed',1,0,NULL,'2026-08-01 09:51:17'),(5,'Karigar Charges','variable',1,0,NULL,'2026-08-01 09:51:17'),(6,'Marketing','variable',1,0,NULL,'2026-08-01 09:51:17'),(7,'Office Supplies','variable',1,0,NULL,'2026-08-01 09:51:17');
/*!40000 ALTER TABLE `expense_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expense_reminders`
--

DROP TABLE IF EXISTS `expense_reminders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `expense_reminders` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int(10) unsigned NOT NULL,
  `fixed_cost_item_id` int(10) unsigned DEFAULT NULL,
  `due_day` tinyint(3) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_reminders_category` (`category_id`),
  KEY `idx_reminders_item` (`fixed_cost_item_id`),
  CONSTRAINT `fk_reminders_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reminders_item` FOREIGN KEY (`fixed_cost_item_id`) REFERENCES `fixed_cost_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expense_reminders`
--

LOCK TABLES `expense_reminders` WRITE;
/*!40000 ALTER TABLE `expense_reminders` DISABLE KEYS */;
/*!40000 ALTER TABLE `expense_reminders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `expenses` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `expense_date` date NOT NULL,
  `category_id` int(10) unsigned NOT NULL,
  `fixed_cost_item_id` int(10) unsigned DEFAULT NULL,
  `type` enum('fixed','variable') NOT NULL DEFAULT 'variable',
  `amount` decimal(12,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `paid_to` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `payment_mode` enum('cash','bank','upi','cheque','card') NOT NULL DEFAULT 'cash',
  `bank_account_id` int(10) unsigned DEFAULT NULL,
  `ref_table` varchar(40) DEFAULT NULL,
  `ref_id` int(10) unsigned DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `ledger_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_date_category` (`expense_date`,`category_id`),
  KEY `idx_expenses_item` (`fixed_cost_item_id`),
  KEY `idx_expenses_bank` (`bank_account_id`),
  KEY `idx_expenses_category` (`category_id`),
  KEY `fk_expenses_creator` (`created_by`),
  KEY `idx_expenses_voucher` (`voucher_id`),
  KEY `fk_expenses_ledger` (`ledger_id`),
  CONSTRAINT `fk_expenses_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expenses_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`),
  CONSTRAINT `fk_expenses_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expenses_item` FOREIGN KEY (`fixed_cost_item_id`) REFERENCES `fixed_cost_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expenses_ledger` FOREIGN KEY (`ledger_id`) REFERENCES `ledger_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expenses_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
INSERT INTO `expenses` VALUES (1,'2026-08-01',3,NULL,'fixed',85000.00,'Showroom rent — Zaveri Bazaar','Kalbadevi Estates',NULL,'bank',1,NULL,NULL,1,'2026-08-01 09:51:19',34,32),(2,'2026-07-01',3,NULL,'fixed',85000.00,'Showroom rent — previous month','Kalbadevi Estates',NULL,'bank',1,NULL,NULL,1,'2026-08-01 09:51:19',35,32),(3,'2026-07-28',4,NULL,'variable',14200.00,'Electricity bill','BEST',NULL,'upi',1,NULL,NULL,1,'2026-08-01 09:51:19',36,33),(4,'2026-07-23',4,NULL,'variable',3100.00,'Internet & telephone','Airtel',NULL,'upi',1,NULL,NULL,1,'2026-08-01 09:51:19',37,33),(5,'2026-07-14',4,NULL,'variable',6800.00,'Water & maintenance','Society',NULL,'cash',NULL,NULL,NULL,1,'2026-08-01 09:51:19',38,33),(6,'2026-07-26',5,NULL,'variable',24500.00,'Setting charges — 9 pieces','Shree Jewel Craft',NULL,'cash',NULL,NULL,NULL,1,'2026-08-01 09:51:19',39,34),(7,'2026-07-19',5,NULL,'variable',11800.00,'Rhodium & polish work','Sai Karigar Works',NULL,'upi',1,NULL,NULL,1,'2026-08-01 09:51:19',40,34),(8,'2026-07-24',6,NULL,'variable',32000.00,'Festival campaign — Instagram & Meta ads','Digital agency',NULL,'card',1,NULL,NULL,1,'2026-08-01 09:51:19',41,35),(9,'2026-07-11',6,NULL,'variable',9500.00,'Newspaper insert — local edition','Sakal Media',NULL,'bank',1,NULL,NULL,1,'2026-08-01 09:51:19',42,35),(10,'2026-07-29',7,NULL,'variable',4300.00,'Boxes, pouches & billing stationery','Amrut Pack & Print',NULL,'cash',NULL,NULL,NULL,1,'2026-08-01 09:51:19',43,36),(11,'2026-07-16',7,NULL,'variable',2650.00,'Hallmarking pouches','Amrut Pack & Print',NULL,'cash',NULL,NULL,NULL,1,'2026-08-01 09:51:19',44,36),(12,'2026-07-31',4,NULL,'variable',1900.00,'Diesel — generator','HP Petrol Pump',NULL,'cash',NULL,NULL,NULL,1,'2026-08-01 09:51:19',45,33),(13,'2026-08-01',5,NULL,'variable',10000.00,NULL,'nothing',NULL,'cash',NULL,NULL,NULL,7,'2026-08-01 11:21:28',64,34);
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `family_members`
--

DROP TABLE IF EXISTS `family_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `family_members` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` int(10) unsigned NOT NULL,
  `relation` varchar(30) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `dob` date DEFAULT NULL,
  `anniversary` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_family_customer` (`customer_id`),
  CONSTRAINT `fk_family_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `family_members`
--

LOCK TABLES `family_members` WRITE;
/*!40000 ALTER TABLE `family_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `family_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fixed_cost_items`
--

DROP TABLE IF EXISTS `fixed_cost_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fixed_cost_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` int(10) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fixed_items_name` (`category_id`,`name`),
  CONSTRAINT `fk_fixed_items_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fixed_cost_items`
--

LOCK TABLES `fixed_cost_items` WRITE;
/*!40000 ALTER TABLE `fixed_cost_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `fixed_cost_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fixed_cost_monthly_payments`
--

DROP TABLE IF EXISTS `fixed_cost_monthly_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `fixed_cost_monthly_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `fixed_cost_item_id` int(10) unsigned NOT NULL,
  `month` tinyint(3) unsigned NOT NULL,
  `year` smallint(5) unsigned NOT NULL,
  `paid_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('paid','pending') NOT NULL DEFAULT 'pending',
  `payment_date` date DEFAULT NULL,
  `expense_id` int(10) unsigned DEFAULT NULL,
  `payroll_item_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tracker` (`fixed_cost_item_id`,`month`,`year`),
  KEY `idx_tracker_expense` (`expense_id`),
  KEY `idx_tracker_payroll` (`payroll_item_id`),
  CONSTRAINT `fk_tracker_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tracker_item` FOREIGN KEY (`fixed_cost_item_id`) REFERENCES `fixed_cost_items` (`id`),
  CONSTRAINT `fk_tracker_payroll` FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fixed_cost_monthly_payments`
--

LOCK TABLES `fixed_cost_monthly_payments` WRITE;
/*!40000 ALTER TABLE `fixed_cost_monthly_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `fixed_cost_monthly_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_categories`
--

DROP TABLE IF EXISTS `inventory_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `item_type` enum('raw_material','stock') NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_categories` (`name`,`item_type`)
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_categories`
--

LOCK TABLES `inventory_categories` WRITE;
/*!40000 ALTER TABLE `inventory_categories` DISABLE KEYS */;
INSERT INTO `inventory_categories` VALUES (1,'Ring','stock',1,'2026-07-28 13:25:20'),(2,'Chain','stock',1,'2026-07-28 13:25:20'),(3,'Necklace','stock',1,'2026-07-28 13:25:20'),(4,'Bangle','stock',1,'2026-07-28 13:25:20'),(5,'Bracelet','stock',1,'2026-07-28 13:25:20'),(6,'Earring','stock',1,'2026-07-28 13:25:20'),(7,'Pendant','stock',1,'2026-07-28 13:25:20'),(8,'Coin & Bar','stock',1,'2026-07-28 13:25:20'),(9,'Raw Metal','raw_material',1,'2026-07-28 13:25:20'),(10,'Old Metal','raw_material',1,'2026-07-28 13:25:20');
/*!40000 ALTER TABLE `inventory_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_items`
--

DROP TABLE IF EXISTS `inventory_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `item_code` varchar(30) NOT NULL,
  `barcode` varchar(64) DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `item_type` enum('raw_material','stock','old_metal') NOT NULL DEFAULT 'stock',
  `category_id` int(10) unsigned DEFAULT NULL,
  `unit_id` int(10) unsigned NOT NULL,
  `current_stock` decimal(12,3) NOT NULL DEFAULT 0.000,
  `avg_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `selling_price` decimal(12,2) DEFAULT NULL,
  `purchase_price` decimal(14,2) NOT NULL DEFAULT 0.00,
  `vendor_id` int(10) unsigned DEFAULT NULL,
  `status` enum('in_stock','sold','removed') NOT NULL DEFAULT 'in_stock',
  `images_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images_json`)),
  `reorder_level` decimal(12,3) NOT NULL DEFAULT 0.000,
  `description` varchar(255) DEFAULT NULL,
  `metal` varchar(30) DEFAULT NULL,
  `purity_id` int(10) unsigned DEFAULT NULL,
  `tracking` enum('tagged','bulk') NOT NULL DEFAULT 'bulk',
  `gross_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `net_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `stone_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `making_type` enum('per_gram','fixed','percent') NOT NULL DEFAULT 'per_gram',
  `diamond_ct` decimal(7,3) NOT NULL DEFAULT 0.000,
  `diamond_pcs` int(10) unsigned NOT NULL DEFAULT 0,
  `making_value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `huid` varchar(10) DEFAULT NULL,
  `wastage_pct` decimal(6,3) NOT NULL DEFAULT 0.000,
  `hsn_code` varchar(12) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_items_code` (`item_code`),
  UNIQUE KEY `uq_inventory_items_huid` (`huid`),
  KEY `idx_inventory_items_type` (`item_type`),
  KEY `idx_inventory_items_category` (`category_id`),
  KEY `idx_inventory_items_name` (`name`),
  KEY `idx_inventory_items_unit` (`unit_id`),
  KEY `fk_inventory_items_creator` (`created_by`),
  KEY `idx_inventory_vendor` (`vendor_id`),
  KEY `idx_inventory_jw_status` (`status`),
  KEY `idx_inventory_items_metal` (`metal`,`purity_id`),
  KEY `idx_inventory_items_status` (`status`,`tracking`),
  KEY `fk_inventory_items_purity` (`purity_id`),
  CONSTRAINT `fk_inventory_items_category` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inventory_items_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inventory_items_purity` FOREIGN KEY (`purity_id`) REFERENCES `purities` (`id`),
  CONSTRAINT `fk_inventory_items_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=334 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_items`
--

LOCK TABLES `inventory_items` WRITE;
/*!40000 ALTER TABLE `inventory_items` DISABLE KEYS */;
INSERT INTO `inventory_items` VALUES (287,'ST-0001',NULL,NULL,'Gold Bangle Pair — antique finish','stock',4,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',42.500,41.200,1.300,'per_gram',0.000,0,620.00,'486748',0.000,'7113',NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:18'),(288,'ST-0002',NULL,NULL,'Gold Kada — plain','stock',4,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',35.100,35.100,0.000,'per_gram',0.000,0,480.00,'272D25',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(289,'ST-0003',NULL,NULL,'Gold Chain 20\" — rope','stock',2,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',24.360,24.360,0.000,'per_gram',0.000,0,420.00,'01B9E0',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(290,'ST-0004',NULL,NULL,'Gold Chain 24\" — box','stock',2,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',31.180,31.180,0.000,'per_gram',0.000,0,420.00,'87B56F',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(291,'ST-0005',NULL,NULL,'Bridal Necklace Set — temple','stock',3,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',88.420,82.640,5.780,'per_gram',0.000,0,780.00,'64EEFF',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(292,'ST-0006',NULL,NULL,'Gold Necklace — kundan','stock',3,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',54.900,49.300,5.600,'fixed',0.000,0,42000.00,'6D0206',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(293,'ST-0007',NULL,NULL,'Jhumka Earrings — temple design','stock',6,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',18.460,17.240,1.220,'per_gram',0.000,0,560.00,'E7E4A7',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(294,'ST-0008',NULL,NULL,'Stud Earrings — daily wear','stock',6,2,0.000,5240.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',3,'tagged',6.220,6.220,0.000,'per_gram',0.000,0,640.00,'DDB411',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(295,'ST-0009',NULL,NULL,'Diamond Solitaire Ring','stock',1,2,0.000,5240.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',3,'tagged',5.240,4.100,1.140,'fixed',0.000,0,18500.00,'35FC43',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(296,'RM-0001',NULL,NULL,'Gold 24K (bulk)','raw_material',NULL,2,250.000,6960.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'bulk',0.000,0.000,0.000,'per_gram',0.000,0,0.00,NULL,0.000,NULL,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(297,'ST-0010',NULL,NULL,'Gents Ring — signet','stock',1,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',9.860,9.860,0.000,'per_gram',0.000,0,520.00,'B662D9',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(298,'ST-0011',NULL,NULL,'Ladies Ring — floral','stock',1,2,0.000,5240.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',3,'tagged',4.180,3.960,0.220,'percent',0.000,0,12.00,'90F2BE',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(299,'ST-0012',NULL,NULL,'Pendant — Ganesh','stock',7,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',7.640,7.640,0.000,'per_gram',0.000,0,540.00,'8939C4',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(300,'ST-0013',NULL,NULL,'Pendant Set with chain','stock',7,2,0.000,5240.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',3,'tagged',12.320,11.480,0.840,'fixed',0.000,0,9500.00,'2C6E69',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(301,'ST-0014',NULL,NULL,'Gold Bracelet — cuban link','stock',5,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',22.740,22.740,0.000,'per_gram',0.000,0,500.00,'348C02',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:19'),(302,'ST-0015',NULL,NULL,'Gold Coin 10 g — 999','stock',8,2,10.000,6960.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'tagged',10.000,10.000,0.000,'fixed',0.000,0,350.00,'C0EECC',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:19'),(303,'ST-0016',NULL,NULL,'Gold Coin 5 g — 999','stock',8,2,5.000,6960.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'tagged',5.000,5.000,0.000,'fixed',0.000,0,250.00,'4C9E3F',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(304,'ST-0017',NULL,NULL,'Gold Bar 20 g — 999','stock',8,2,20.000,6960.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'tagged',20.000,20.000,0.000,'fixed',0.000,0,600.00,'6A619C',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(305,'RM-0002',NULL,NULL,'Silver 999 (bulk)','raw_material',NULL,2,3196.500,93.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',4,'bulk',0.000,0.000,0.000,'per_gram',0.000,0,0.00,NULL,0.000,NULL,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:19'),(306,'ST-0018',NULL,NULL,'Silver Payal Pair — ghungroo','stock',4,2,124.600,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',124.600,124.600,0.000,'per_gram',0.000,0,11.00,'9BF675',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(307,'ST-0019',NULL,NULL,'Silver Bracelet — oxidised','stock',5,2,46.200,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',46.200,46.200,0.000,'per_gram',0.000,0,14.00,'D396AC',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(308,'ST-0020',NULL,NULL,'Silver Chain — 18\"','stock',2,2,28.400,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',28.400,28.400,0.000,'per_gram',0.000,0,12.00,'101ED7',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(309,'ST-0021',NULL,NULL,'Silver Pooja Coin 20 g','stock',8,2,20.000,93.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',4,'tagged',20.000,20.000,0.000,'fixed',0.000,0,180.00,'065525',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(310,'ST-0022',NULL,NULL,'Silver Toe Ring Set','stock',1,2,12.800,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',12.800,12.800,0.000,'per_gram',0.000,0,15.00,'18BD9C',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(311,'ST-0023',NULL,NULL,'Gold Mangalsutra — short','stock',3,2,16.240,6510.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'tagged',16.940,16.240,0.700,'per_gram',0.000,0,600.00,'D92CD9',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(312,'ST-0024',NULL,NULL,'Gold Nose Pin','stock',7,2,1.180,5240.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',3,'tagged',1.240,1.180,0.060,'fixed',0.000,0,1200.00,'E1488D',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(313,'ST-0025',NULL,NULL,'Gold Bangle — single, machine cut','stock',4,2,19.780,6510.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'tagged',19.780,19.780,0.000,'per_gram',0.000,0,540.00,'C50CBC',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(314,'ST-0026',NULL,NULL,'Gold Bangle Set of 4 — thin','stock',4,2,28.640,6510.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'tagged',28.640,28.640,0.000,'per_gram',0.000,0,560.00,'1EDF1E',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(315,'ST-0027',NULL,NULL,'Gold Chain 18\" — figaro','stock',2,2,18.920,6510.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'tagged',18.920,18.920,0.000,'per_gram',0.000,0,420.00,'F45CE7',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(316,'ST-0028',NULL,NULL,'Gold Haar — long rani','stock',3,2,91.400,6510.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'tagged',96.280,91.400,4.880,'per_gram',0.000,0,820.00,'6DA6D4',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(317,'ST-0029',NULL,NULL,'Choker Necklace — polki','stock',3,2,38.200,5240.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',3,'tagged',44.600,38.200,6.400,'fixed',0.000,0,65000.00,'CD68D7',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(318,'ST-0030',NULL,NULL,'Chandbali Earrings — 22K','stock',6,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',21.340,20.180,1.160,'per_gram',0.000,0,580.00,'9FDB01',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 10:07:46'),(319,'ST-0031',NULL,NULL,'Hoop Earrings — 18K','stock',6,2,4.860,5240.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',3,'tagged',4.860,4.860,0.000,'per_gram',0.000,0,620.00,'3640C8',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(320,'ST-0032',NULL,NULL,'Cocktail Ring — CZ','stock',1,2,5.940,5240.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',3,'tagged',6.480,5.940,0.540,'fixed',0.000,0,14500.00,'5B35D0',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(321,'ST-0033',NULL,NULL,'Engagement Ring — solitaire 0.5ct','stock',1,2,3.680,5240.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',3,'tagged',4.920,3.680,1.240,'fixed',0.000,0,26000.00,'CD0BBC',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(322,'ST-0034',NULL,NULL,'Baby Bangle Pair — 22K','stock',4,2,0.000,6510.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',11.260,11.260,0.000,'per_gram',0.000,0,520.00,'ABAF58',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 10:02:42'),(323,'ST-0035',NULL,NULL,'Gold Coin 2 g — 999','stock',8,2,2.000,6960.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'tagged',2.000,2.000,0.000,'fixed',0.000,0,180.00,'89FDE9',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(324,'ST-0036',NULL,NULL,'Silver Dinner Set — 6 pc','stock',8,2,860.000,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',860.000,860.000,0.000,'per_gram',0.000,0,9.00,'E48CBE',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(325,'ST-0037',NULL,NULL,'Silver Kumkum Box','stock',8,2,96.400,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',96.400,96.400,0.000,'per_gram',0.000,0,13.00,'CC5A42',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(326,'ST-0038',NULL,NULL,'Silver Anklet — kids','stock',4,2,34.200,86.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'silver',5,'tagged',34.200,34.200,0.000,'per_gram',0.000,0,15.00,'26EAAB',0.000,'7113',NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(327,'RM-0003',NULL,NULL,'Gold 22K (bulk)','raw_material',NULL,2,180.000,6510.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'bulk',0.000,0.000,0.000,'per_gram',0.000,0,0.00,NULL,0.000,NULL,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(328,'RM-0004',NULL,NULL,'Old Gold 22K','old_metal',10,2,20.892,7033.84,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',2,'bulk',0.000,0.000,0.000,'per_gram',0.000,0,0.00,NULL,0.000,NULL,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(329,'ST-0039',NULL,NULL,'demo gold','stock',NULL,2,-30.000,0.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',2,'tagged',100.000,30.000,70.000,'per_gram',0.000,0,70.00,NULL,0.000,'7113',NULL,1,1,'2026-08-01 10:13:02','2026-08-01 10:17:07'),(330,'ST-0040',NULL,NULL,'Gold Ring','stock',1,2,20.000,7340.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'tagged',100.000,20.000,80.000,'per_gram',0.000,0,0.00,NULL,0.000,'7113',NULL,1,2,'2026-08-01 10:55:29','2026-08-01 10:55:29'),(331,'ST-0041',NULL,NULL,'Gold Ring','stock',1,2,100.000,7340.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',1,'tagged',100.000,30.000,70.000,'per_gram',0.000,0,0.00,NULL,0.000,'7113',NULL,1,2,'2026-08-01 10:56:40','2026-08-01 10:59:07'),(332,'ST-0042',NULL,NULL,'demo ring','stock',NULL,2,30.000,0.00,NULL,0.00,NULL,'in_stock',NULL,0.000,NULL,'gold',1,'tagged',100.000,30.000,70.000,'per_gram',0.000,0,70.00,NULL,0.000,'7113',NULL,1,7,'2026-08-01 11:02:26','2026-08-01 11:07:10'),(333,'ST-0043',NULL,NULL,'demo gold','stock',NULL,2,70.000,0.00,NULL,0.00,NULL,'sold',NULL,0.000,NULL,'gold',1,'tagged',100.000,30.000,70.000,'per_gram',0.000,0,70.00,NULL,0.000,'7113',NULL,1,7,'2026-08-01 11:08:15','2026-08-01 11:10:55');
/*!40000 ALTER TABLE `inventory_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_transactions`
--

DROP TABLE IF EXISTS `inventory_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inventory_transactions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `item_id` int(10) unsigned NOT NULL,
  `type` enum('in','out') NOT NULL,
  `reason` enum('purchase','sale','adjustment','opening','old_metal_in','production','return') NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rate_per_gram` decimal(12,2) DEFAULT NULL,
  `value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `purchase_id` int(10) unsigned DEFAULT NULL,
  `invoice_id` int(10) unsigned DEFAULT NULL,
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `production_batch` varchar(30) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `adjustment_reason` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_inv_txn_item` (`item_id`,`created_at`),
  KEY `idx_inv_txn_reason` (`reason`),
  KEY `idx_inv_txn_invoice` (`invoice_id`),
  KEY `idx_inv_txn_purchase` (`purchase_id`),
  KEY `fk_inv_txn_creator` (`created_by`),
  KEY `idx_inventory_txn_voucher` (`voucher_id`),
  KEY `idx_inventory_txn_item_date` (`item_id`,`created_at`),
  CONSTRAINT `fk_inv_txn_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv_txn_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv_txn_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_inv_txn_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inventory_txn_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=74 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_transactions`
--

LOCK TABLES `inventory_transactions` WRITE;
/*!40000 ALTER TABLE `inventory_transactions` DISABLE KEYS */;
INSERT INTO `inventory_transactions` VALUES (1,287,'in','purchase',1.000,41.200,6510.00,268212.00,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:17'),(2,288,'in','purchase',1.000,35.100,6510.00,228501.00,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(3,289,'in','purchase',1.000,24.360,6510.00,158583.60,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(4,290,'in','purchase',1.000,31.180,6510.00,202981.80,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(5,291,'in','purchase',1.000,82.640,6510.00,537986.40,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(6,292,'in','purchase',1.000,49.300,6510.00,320943.00,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(7,293,'in','purchase',1.000,17.240,6510.00,112232.40,6510.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(8,294,'in','purchase',1.000,6.220,5240.00,32592.80,5240.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(9,295,'in','purchase',1.000,4.100,5240.00,21484.00,5240.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(10,296,'in','purchase',1.000,250.000,6960.00,1740000.00,6960.00,1,NULL,1,NULL,'Purchase PUR-2627-00001',NULL,1,'2026-08-01 09:51:18'),(11,297,'in','purchase',1.000,9.860,6510.00,64188.60,6510.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(12,298,'in','purchase',1.000,3.960,5240.00,20750.40,5240.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(13,299,'in','purchase',1.000,7.640,6510.00,49736.40,6510.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(14,300,'in','purchase',1.000,11.480,5240.00,60155.20,5240.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(15,301,'in','purchase',1.000,22.740,6510.00,148037.40,6510.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(16,302,'in','purchase',1.000,10.000,6960.00,69600.00,6960.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(17,303,'in','purchase',1.000,5.000,6960.00,34800.00,6960.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(18,304,'in','purchase',1.000,20.000,6960.00,139200.00,6960.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(19,305,'in','purchase',1.000,3200.000,93.00,297600.00,93.00,2,NULL,2,NULL,'Purchase PUR-2627-00002',NULL,1,'2026-08-01 09:51:18'),(20,306,'in','purchase',1.000,124.600,86.00,10715.60,86.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(21,307,'in','purchase',1.000,46.200,86.00,3973.20,86.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(22,308,'in','purchase',1.000,28.400,86.00,2442.40,86.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(23,309,'in','purchase',1.000,20.000,93.00,1860.00,93.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(24,310,'in','purchase',1.000,12.800,86.00,1100.80,86.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(25,311,'in','purchase',1.000,16.240,6510.00,105722.40,6510.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(26,312,'in','purchase',1.000,1.180,5240.00,6183.20,5240.00,3,NULL,3,NULL,'Purchase PUR-2627-00003',NULL,1,'2026-08-01 09:51:18'),(27,313,'in','purchase',1.000,19.780,6510.00,128767.80,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(28,314,'in','purchase',1.000,28.640,6510.00,186446.40,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(29,315,'in','purchase',1.000,18.920,6510.00,123169.20,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(30,316,'in','purchase',1.000,91.400,6510.00,595014.00,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(31,317,'in','purchase',1.000,38.200,5240.00,200168.00,5240.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(32,318,'in','purchase',1.000,20.180,6510.00,131371.80,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(33,319,'in','purchase',1.000,4.860,5240.00,25466.40,5240.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(34,320,'in','purchase',1.000,5.940,5240.00,31125.60,5240.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(35,321,'in','purchase',1.000,3.680,5240.00,19283.20,5240.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(36,322,'in','purchase',1.000,11.260,6510.00,73302.60,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(37,323,'in','purchase',1.000,2.000,6960.00,13920.00,6960.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(38,324,'in','purchase',1.000,860.000,86.00,73960.00,86.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(39,325,'in','purchase',1.000,96.400,86.00,8290.40,86.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(40,326,'in','purchase',1.000,34.200,86.00,2941.20,86.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(41,327,'in','purchase',1.000,180.000,6510.00,1171800.00,6510.00,4,NULL,4,NULL,'Purchase PUR-2627-00004',NULL,1,'2026-08-01 09:51:18'),(42,287,'out','sale',1.000,41.200,6995.17,268212.00,6510.00,NULL,1,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(43,288,'out','sale',1.000,35.100,6995.17,228501.00,6510.00,NULL,1,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(44,289,'out','sale',1.000,24.360,7023.39,158583.60,6510.00,NULL,2,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(45,290,'out','sale',1.000,31.180,7038.70,202981.80,6510.00,NULL,3,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(46,291,'out','sale',1.000,82.640,7038.70,537986.40,6510.00,NULL,3,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(47,328,'in','old_metal_in',1.000,19.288,7038.70,135762.45,7038.70,NULL,3,14,NULL,'Exchange on INV-2627-00003',NULL,1,'2026-08-01 09:51:18'),(48,292,'out','sale',1.000,49.300,7038.14,320943.00,6510.00,NULL,4,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(49,293,'out','sale',1.000,17.240,7021.81,112232.40,6510.00,NULL,5,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(50,294,'out','sale',1.000,6.220,5620.40,32592.80,5240.00,NULL,6,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(51,295,'out','sale',1.000,4.100,5620.40,21484.00,5240.00,NULL,6,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(52,297,'out','sale',1.000,9.860,6975.40,64188.60,6510.00,NULL,7,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(53,328,'in','old_metal_in',1.000,1.604,6975.40,11188.54,6975.40,NULL,7,22,NULL,'Exchange on INV-2627-00007',NULL,1,'2026-08-01 09:51:18'),(54,298,'out','sale',1.000,3.960,5579.00,20750.40,5240.00,NULL,8,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(55,299,'out','sale',1.000,7.640,6957.00,49736.40,6510.00,NULL,8,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(56,300,'out','sale',1.000,11.480,5579.00,60155.20,5240.00,NULL,9,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18'),(57,301,'out','sale',1.000,22.740,6957.00,148037.40,6510.00,NULL,10,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19'),(58,302,'out','sale',1.000,10.000,7340.00,69600.00,6960.00,NULL,11,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19'),(59,302,'in','return',1.000,10.000,7340.00,69600.00,6960.00,NULL,11,NULL,NULL,'Reversal — bill cancelled',NULL,1,'2026-08-01 09:51:19'),(60,305,'out','adjustment',1.000,3.500,NULL,325.50,93.00,NULL,NULL,46,NULL,'Adjustment ADJ-0001','Physical count shortage — dust loss at the polishing bench.',1,'2026-08-01 09:51:19'),(63,322,'out','sale',1.000,11.260,6957.00,73302.60,6510.00,NULL,16,NULL,NULL,NULL,NULL,2,'2026-08-01 10:02:42'),(64,318,'out','sale',1.000,20.180,6957.00,131371.80,6510.00,NULL,17,NULL,NULL,NULL,NULL,2,'2026-08-01 10:07:46'),(65,329,'out','sale',1.000,30.000,6957.00,0.00,0.00,NULL,18,NULL,NULL,NULL,NULL,1,'2026-08-01 10:17:07'),(66,330,'in','purchase',1.000,20.000,7340.00,146800.00,7340.00,6,NULL,55,NULL,'Purchase PUR-2627-00006',NULL,2,'2026-08-01 10:55:29'),(67,331,'in','purchase',1.000,30.000,7340.00,220200.00,7340.00,7,NULL,57,NULL,'Purchase PUR-2627-00007',NULL,2,'2026-08-01 10:56:40'),(68,331,'in','adjustment',6.000,100.000,NULL,734000.00,7340.00,NULL,NULL,59,NULL,'Adjustment ADJ-0002','Found during stock count',7,'2026-08-01 10:57:55'),(69,331,'out','sale',1.000,30.000,7340.00,220200.00,7340.00,NULL,19,NULL,NULL,NULL,NULL,2,'2026-08-01 10:59:07'),(70,332,'in','adjustment',5.000,30.000,NULL,0.00,0.00,NULL,NULL,NULL,NULL,'Adjustment ADJ-0003','Returned by karigar',7,'2026-08-01 11:04:18'),(71,333,'in','adjustment',9.000,100.000,NULL,0.00,0.00,NULL,NULL,NULL,NULL,'Adjustment ADJ-0004','Found during stock count',7,'2026-08-01 11:08:36'),(73,333,'out','sale',1.000,30.000,7340.00,0.00,0.00,NULL,20,NULL,NULL,NULL,NULL,7,'2026-08-01 11:10:55');
/*!40000 ALTER TABLE `inventory_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_items`
--

DROP TABLE IF EXISTS `invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoice_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int(10) unsigned NOT NULL,
  `item_type` enum('tagged','bulk','making','custom') NOT NULL DEFAULT 'tagged',
  `inventory_item_id` int(10) unsigned DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `metal` varchar(30) DEFAULT NULL,
  `gross_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `net_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rate_per_gram` decimal(12,2) NOT NULL DEFAULT 0.00,
  `metal_value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `stone_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `purity_code` varchar(10) DEFAULT NULL,
  `making_charge` decimal(14,2) NOT NULL DEFAULT 0.00,
  `cost_value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `wastage_pct` decimal(6,3) NOT NULL DEFAULT 0.000,
  `hsn_code` varchar(12) DEFAULT NULL,
  `diamond_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `diamond_grade` varchar(30) DEFAULT NULL,
  `qty` decimal(12,3) NOT NULL DEFAULT 1.000,
  `unit` varchar(20) DEFAULT NULL,
  `rate` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_treatment` enum('taxable','exempt','nil_rated','non_gst','reverse_charge') NOT NULL DEFAULT 'taxable',
  `exempt_reason` varchar(120) DEFAULT NULL,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_items_invoice` (`invoice_id`),
  KEY `idx_invoice_items_inventory` (`inventory_item_id`),
  CONSTRAINT `fk_invoice_items_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoice_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_items`
--

LOCK TABLES `invoice_items` WRITE;
/*!40000 ALTER TABLE `invoice_items` DISABLE KEYS */;
INSERT INTO `invoice_items` VALUES (1,1,'tagged',287,'Gold Bangle Pair — antique finish',NULL,42.500,41.200,6995.17,288201.00,0.000,'22K',25544.00,268212.00,0.000,NULL,0.000,NULL,1.000,NULL,6995.17,0.00,3.00,'taxable',NULL,9412.35,4706.18,4706.17,0.00,323157.35,0),(2,1,'tagged',288,'Gold Kada — plain',NULL,35.100,35.100,6995.17,245530.47,0.000,'22K',16848.00,228501.00,0.000,NULL,0.000,NULL,1.000,NULL,6995.17,0.00,3.00,'taxable',NULL,7871.35,3935.68,3935.67,0.00,270249.82,0),(3,2,'tagged',289,'Gold Chain 20\" — rope',NULL,24.360,24.360,7023.39,171089.78,0.000,'22K',10231.20,158583.60,0.000,NULL,0.000,NULL,1.000,NULL,7023.39,0.00,3.00,'taxable',NULL,5439.63,2719.82,2719.81,0.00,186760.61,0),(6,3,'tagged',290,'Gold Chain 24\" — box',NULL,31.180,31.180,7038.70,219466.67,0.000,'22K',13095.60,202981.80,0.000,NULL,0.000,NULL,1.000,NULL,7038.70,0.00,3.00,'taxable',NULL,6976.87,3488.44,3488.43,0.00,239539.14,0),(7,3,'tagged',291,'Bridal Necklace Set — temple',NULL,88.420,82.640,7038.70,581678.17,0.000,'22K',64459.20,537986.40,0.000,NULL,0.000,NULL,1.000,NULL,7038.70,0.00,3.00,'taxable',NULL,19384.12,9692.06,9692.06,0.00,665521.49,0),(8,4,'tagged',292,'Gold Necklace — kundan',NULL,54.900,49.300,7038.14,336874.08,0.000,'22K',40776.70,320943.00,0.000,NULL,0.000,NULL,1.000,NULL,7038.14,0.00,3.00,'taxable',NULL,11329.52,5664.76,5664.76,0.00,388980.30,0),(9,5,'tagged',293,'Jhumka Earrings — temple design',NULL,18.460,17.240,7021.81,121056.00,0.000,'22K',9654.40,112232.40,0.000,NULL,0.000,NULL,1.000,NULL,7021.81,0.00,3.00,'taxable',NULL,3921.31,1960.66,1960.65,0.00,134631.71,0),(10,6,'tagged',294,'Stud Earrings — daily wear',NULL,6.220,6.220,5620.40,34958.89,0.000,'18K',3980.80,32592.80,0.000,NULL,0.000,NULL,1.000,NULL,5620.40,0.00,3.00,'taxable',NULL,1168.19,584.10,584.09,0.00,40107.88,0),(11,6,'tagged',295,'Diamond Solitaire Ring',NULL,5.240,4.100,5620.40,23043.64,0.000,'18K',18500.00,21484.00,0.000,NULL,0.000,NULL,1.000,NULL,5620.40,0.00,3.00,'taxable',NULL,1246.31,623.16,623.15,0.00,42789.95,0),(13,7,'tagged',297,'Gents Ring — signet',NULL,9.860,9.860,6975.40,68777.44,0.000,'22K',5127.20,64188.60,0.000,NULL,0.000,NULL,1.000,NULL,6975.40,0.00,3.00,'taxable',NULL,2217.14,1108.57,1108.57,0.00,76121.78,0),(14,8,'tagged',298,'Ladies Ring — floral',NULL,4.180,3.960,5579.00,21449.36,0.000,'18K',2573.92,20750.40,0.000,NULL,0.000,NULL,1.000,NULL,5579.00,0.00,3.00,'taxable',NULL,720.70,360.35,360.35,0.00,24743.98,0),(15,8,'tagged',299,'Pendant — Ganesh',NULL,7.640,7.640,6957.00,51603.38,0.000,'22K',4005.44,49736.40,0.000,NULL,0.000,NULL,1.000,NULL,6957.00,0.00,3.00,'taxable',NULL,1668.26,834.13,834.13,0.00,57277.08,0),(16,9,'tagged',300,'Pendant Set with chain',NULL,12.320,11.480,5579.00,64046.92,0.000,'18K',9500.00,60155.20,0.000,NULL,0.000,NULL,1.000,NULL,5579.00,0.00,3.00,'taxable',NULL,2206.41,1103.21,1103.20,0.00,75753.33,0),(17,10,'tagged',301,'Gold Bracelet — cuban link',NULL,22.740,22.740,6957.00,158202.18,0.000,'22K',11370.00,148037.40,0.000,NULL,0.000,NULL,1.000,NULL,6957.00,0.00,3.00,'taxable',NULL,5087.17,2543.59,2543.58,0.00,174659.35,0),(18,11,'tagged',302,'Gold Coin 10 g — 999',NULL,10.000,10.000,7340.00,73400.00,0.000,'24K',350.00,69600.00,0.000,NULL,0.000,NULL,1.000,NULL,7340.00,0.00,3.00,'taxable',NULL,2212.50,1106.25,1106.25,0.00,75962.50,0),(19,12,'tagged',302,'Gold Coin 10 g — 999',NULL,10.000,10.000,7340.00,73400.00,0.000,'24K',350.00,0.00,0.000,NULL,0.000,NULL,1.000,NULL,7340.00,0.00,3.00,'taxable',NULL,2212.50,1106.25,1106.25,0.00,75962.50,0),(20,12,'tagged',303,'Gold Coin 5 g — 999',NULL,5.000,5.000,7340.00,36700.00,0.000,'24K',250.00,0.00,0.000,NULL,0.000,NULL,1.000,NULL,7340.00,0.00,3.00,'taxable',NULL,1108.50,554.25,554.25,0.00,38058.50,0),(21,13,'tagged',304,'Gold Bar 20 g — 999',NULL,20.000,20.000,7340.00,146800.00,0.000,'24K',600.00,0.00,0.000,NULL,0.000,NULL,1.000,NULL,7340.00,0.00,3.00,'taxable',NULL,4422.00,2211.00,2211.00,0.00,151822.00,0),(22,13,'tagged',306,'Silver Payal Pair — ghungroo',NULL,124.600,124.600,92.50,11525.50,0.000,'925',1370.60,0.00,0.000,NULL,0.000,NULL,1.000,NULL,92.50,0.00,3.00,'taxable',NULL,386.88,193.44,193.44,0.00,13282.98,0),(23,14,'tagged',307,'Silver Bracelet — oxidised',NULL,46.200,46.200,92.50,4273.50,0.000,'925',646.80,0.00,0.000,NULL,0.000,NULL,1.000,NULL,92.50,0.00,3.00,'taxable',NULL,147.61,73.81,73.80,0.00,5067.91,0),(24,14,'tagged',308,'Silver Chain — 18\"',NULL,28.400,28.400,92.50,2627.00,0.000,'925',340.80,0.00,0.000,NULL,0.000,NULL,1.000,NULL,92.50,0.00,3.00,'taxable',NULL,89.03,44.52,44.51,0.00,3056.83,0),(25,15,'bulk',NULL,'Gold chain 22\" — 22K rope',NULL,0.000,22.400,6957.00,155836.80,0.000,'22K',9408.00,0.00,0.000,NULL,0.000,NULL,1.000,NULL,6957.00,0.00,3.00,'taxable',NULL,4957.34,2478.67,2478.67,0.00,170202.14,0),(28,16,'tagged',322,'Baby Bangle Pair — 22K',NULL,11.260,11.260,6957.00,78335.82,0.000,'22K',5855.20,73302.60,0.000,NULL,0.000,NULL,1.000,NULL,6957.00,0.00,3.00,'taxable',NULL,2525.73,1262.87,1262.86,0.00,86716.75,0),(29,17,'tagged',318,'Chandbali Earrings — 22K',NULL,21.340,20.180,6957.00,140392.26,0.000,'22K',11704.40,131371.80,0.000,NULL,0.000,NULL,1.000,NULL,6957.00,0.00,3.00,'non_gst','snothing',0.00,0.00,0.00,0.00,152096.66,0),(30,18,'tagged',329,'demo gold',NULL,100.000,30.000,6957.00,208710.00,0.000,'22K',2100.00,0.00,0.000,NULL,0.000,NULL,1.000,NULL,6957.00,0.00,3.00,'non_gst','jhhh',0.00,0.00,0.00,0.00,210810.00,0),(31,19,'tagged',331,'Gold Ring',NULL,100.000,30.000,7340.00,220200.00,0.000,'24K',0.00,220200.00,0.000,NULL,0.000,NULL,1.000,NULL,7340.00,0.00,3.00,'non_gst','Without GST',0.00,0.00,0.00,0.00,220200.00,0),(33,20,'tagged',333,'demo gold',NULL,100.000,30.000,7340.00,220200.00,0.000,'24K',2100.00,0.00,0.000,NULL,0.000,NULL,1.000,NULL,7340.00,0.00,3.00,'non_gst','Without GST',0.00,0.00,0.00,0.00,222300.00,0);
/*!40000 ALTER TABLE `invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_old_metal`
--

DROP TABLE IF EXISTS `invoice_old_metal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoice_old_metal` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int(10) unsigned NOT NULL,
  `metal` varchar(30) NOT NULL,
  `purity_id` int(10) unsigned DEFAULT NULL,
  `description` varchar(150) DEFAULT NULL,
  `gross_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `deduction_pct` decimal(5,2) NOT NULL DEFAULT 0.00,
  `net_weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rate_per_gram` decimal(12,2) NOT NULL DEFAULT 0.00,
  `value` decimal(14,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_old_metal_invoice` (`invoice_id`),
  KEY `fk_invoice_old_metal_purity` (`purity_id`),
  CONSTRAINT `fk_invoice_old_metal_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_old_metal_purity` FOREIGN KEY (`purity_id`) REFERENCES `purities` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_old_metal`
--

LOCK TABLES `invoice_old_metal` WRITE;
/*!40000 ALTER TABLE `invoice_old_metal` DISABLE KEYS */;
INSERT INTO `invoice_old_metal` VALUES (1,3,'gold',2,'Old gold bangle taken in exchange',20.965,8.00,19.288,7038.70,135762.45),(2,7,'gold',2,'Old gold bangle taken in exchange',1.744,8.00,1.604,6975.40,11188.54);
/*!40000 ALTER TABLE `invoice_old_metal` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoice_payments`
--

DROP TABLE IF EXISTS `invoice_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoice_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` int(10) unsigned DEFAULT NULL,
  `customer_id` int(10) unsigned DEFAULT NULL,
  `receipt_no` varchar(30) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_mode` enum('cash','upi','bank','card','cheque') NOT NULL DEFAULT 'cash',
  `bank_account_id` int(10) unsigned DEFAULT NULL,
  `cheque_number` varchar(50) DEFAULT NULL,
  `cheque_date` date DEFAULT NULL,
  `cheque_bank` varchar(100) DEFAULT NULL,
  `cheque_status` enum('pending','deposited','cleared','bounced') DEFAULT NULL,
  `cheque_cleared_at` datetime DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `status` enum('active','cancelled') NOT NULL DEFAULT 'active',
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_receipt` (`receipt_no`),
  KEY `idx_payments_invoice` (`invoice_id`),
  KEY `idx_payments_date` (`payment_date`),
  KEY `idx_payments_bank` (`bank_account_id`),
  KEY `fk_payments_creator` (`created_by`),
  KEY `idx_invoice_payments_customer` (`customer_id`),
  KEY `fk_invoice_payments_voucher` (`voucher_id`),
  CONSTRAINT `fk_invoice_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoice_payments_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoice_payments`
--

LOCK TABLES `invoice_payments` WRITE;
/*!40000 ALTER TABLE `invoice_payments` DISABLE KEYS */;
INSERT INTO `invoice_payments` VALUES (1,1,1,'RCPT-2627-00001',591907.00,'2026-07-20','upi',NULL,NULL,NULL,NULL,NULL,NULL,NULL,11,'active',1,'2026-08-01 09:51:18'),(2,2,NULL,'RCPT-2627-00002',186761.00,'2026-07-22','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,13,'active',1,'2026-08-01 09:51:18'),(3,3,2,'RCPT-2627-00003',346184.10,'2026-07-24','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,15,'active',1,'2026-08-01 09:51:18'),(4,3,2,'RCPT-2627-00004',230789.40,'2026-07-27','upi',NULL,NULL,NULL,NULL,NULL,NULL,'Balance instalment',16,'active',1,'2026-08-01 09:51:18'),(5,4,3,'RCPT-2627-00005',387480.00,'2026-07-26','card',1,NULL,NULL,NULL,NULL,NULL,NULL,18,'active',1,'2026-08-01 09:51:18'),(6,6,5,'RCPT-2627-00006',37304.10,'2026-07-29','bank',1,NULL,NULL,NULL,NULL,NULL,NULL,21,'active',1,'2026-08-01 09:51:18'),(7,7,6,'RCPT-2627-00007',63433.00,'2026-07-31','upi',NULL,NULL,NULL,NULL,NULL,NULL,NULL,23,'active',1,'2026-08-01 09:51:18'),(8,8,7,'RCPT-2627-00008',82021.00,'2026-08-01','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,25,'active',1,'2026-08-01 09:51:18'),(9,9,NULL,'RCPT-2627-00009',75753.00,'2026-08-01','upi',NULL,NULL,NULL,NULL,NULL,NULL,NULL,27,'active',1,'2026-08-01 09:51:18'),(10,11,NULL,'RCPT-2627-00010',75963.00,'2026-08-01','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,30,'active',1,'2026-08-01 09:51:19'),(11,15,5,'RCPT-2627-00011',170202.00,'2026-08-01','upi',NULL,NULL,NULL,NULL,NULL,NULL,NULL,32,'active',1,'2026-08-01 09:51:19'),(12,NULL,1,'RCPT-2627-00012',50000.00,'2026-08-01','bank',1,NULL,NULL,NULL,NULL,NULL,'Advance towards the bridal order',33,'active',1,'2026-08-01 09:51:19'),(13,16,NULL,'RCPT-2627-00013',86717.00,'2026-08-02','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,50,'active',2,'2026-08-01 10:02:42'),(14,17,1,'RCPT-2627-00014',152097.00,'2026-08-01','upi',NULL,NULL,NULL,NULL,NULL,NULL,NULL,52,'active',2,'2026-08-01 10:07:46'),(15,18,1,'RCPT-2627-00015',210810.00,'2026-08-01','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,54,'active',1,'2026-08-01 10:17:07'),(16,20,NULL,'RCPT-2627-00016',222300.00,'2026-08-01','cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL,63,'active',7,'2026-08-01 11:10:55');
/*!40000 ALTER TABLE `invoice_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `invoices` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `invoice_no` varchar(30) DEFAULT NULL,
  `customer_id` int(10) unsigned DEFAULT NULL,
  `walkin_name` varchar(150) DEFAULT NULL,
  `walkin_phone` varchar(20) DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `price_mode` enum('exclusive','inclusive') NOT NULL DEFAULT 'exclusive',
  `estimate_id` int(10) unsigned DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','final','cancelled') NOT NULL DEFAULT 'draft',
  `sale_type` enum('ready','custom') NOT NULL DEFAULT 'ready',
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `metal_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `making_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `old_metal_value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `round_off` decimal(6,2) NOT NULL DEFAULT 0.00,
  `tax_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `finalized_at` datetime DEFAULT NULL,
  `cancelled_by` int(10) unsigned DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `terms` varchar(1000) DEFAULT NULL,
  `hallmark_no` varchar(40) DEFAULT NULL,
  `huid` varchar(40) DEFAULT NULL,
  `warranty_months` int(11) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoices_no` (`invoice_no`),
  KEY `idx_invoices_customer` (`customer_id`),
  KEY `idx_invoices_status` (`status`),
  KEY `idx_invoices_date` (`invoice_date`),
  KEY `idx_invoices_due` (`due_date`),
  KEY `fk_invoices_creator` (`created_by`),
  KEY `idx_invoices_voucher` (`voucher_id`),
  KEY `fk_invoices_estimate` (`estimate_id`),
  CONSTRAINT `fk_invoices_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  CONSTRAINT `fk_invoices_estimate` FOREIGN KEY (`estimate_id`) REFERENCES `estimates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_invoices_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `invoices`
--

LOCK TABLES `invoices` WRITE;
/*!40000 ALTER TABLE `invoices` DISABLE KEYS */;
INSERT INTO `invoices` VALUES (1,'INV-2627-00001',1,NULL,NULL,'2026-07-20','exclusive',NULL,NULL,'final','ready',576123.47,533731.47,42392.00,1500.00,0.00,-0.17,17283.70,8641.86,8641.84,0.00,591907.00,591907.00,10,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(2,'INV-2627-00002',NULL,'Kavita Rane','9867003344','2026-07-22','exclusive',NULL,NULL,'final','ready',181320.98,171089.78,10231.20,0.00,0.00,0.39,5439.63,2719.82,2719.81,0.00,186761.00,186761.00,12,'2026-08-01 15:21:18',NULL,NULL,NULL,'Counter sale',NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(3,'INV-2627-00003',2,NULL,NULL,'2026-07-24','exclusive',NULL,NULL,'final','ready',878699.64,801144.84,77554.80,0.00,135762.45,-0.18,26360.99,13180.50,13180.49,0.00,769298.00,576973.50,14,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(4,'INV-2627-00004',3,NULL,NULL,'2026-07-26','inclusive',NULL,NULL,'final','ready',377650.78,336874.08,40776.70,1500.00,0.00,-0.30,11329.52,5664.76,5664.76,0.00,387480.00,387480.00,17,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(5,'INV-2627-00005',4,NULL,NULL,'2026-07-28','exclusive',NULL,NULL,'final','ready',130710.40,121056.00,9654.40,0.00,0.00,0.29,3921.31,1960.66,1960.65,0.00,134632.00,0.00,19,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(6,'INV-2627-00006',5,NULL,NULL,'2026-07-29','exclusive',NULL,NULL,'final','ready',80483.33,58002.53,22480.80,0.00,0.00,0.17,2414.50,1207.26,1207.24,0.00,82898.00,37304.10,20,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(7,'INV-2627-00007',6,NULL,NULL,'2026-07-31','exclusive',NULL,NULL,'final','ready',73904.64,68777.44,5127.20,1500.00,11188.54,-0.24,2217.14,1108.57,1108.57,0.00,63433.00,63433.00,22,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(8,'INV-2627-00008',7,NULL,NULL,'2026-08-01','inclusive',NULL,NULL,'final','ready',79632.10,73052.74,6579.36,0.00,0.00,-0.06,2388.96,1194.48,1194.48,0.00,82021.00,82021.00,24,'2026-08-01 15:21:18',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(9,'INV-2627-00009',NULL,'Ramesh Joshi','9867001122','2026-08-01','exclusive',NULL,NULL,'final','ready',73546.92,64046.92,9500.00,0.00,0.00,-0.33,2206.41,1103.21,1103.20,0.00,75753.00,75753.00,26,'2026-08-01 15:21:18',NULL,NULL,NULL,'Counter sale',NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(10,'INV-2627-00010',8,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'final','ready',169572.18,158202.18,11370.00,1500.00,0.00,-0.35,5087.17,2543.59,2543.58,0.00,173159.00,0.00,28,'2026-08-01 15:21:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(11,'INV-2627-00011',NULL,'Nikhil Bhatt','9867009900','2026-08-01','exclusive',NULL,NULL,'cancelled','ready',73750.00,73400.00,350.00,0.00,0.00,0.50,2212.50,1106.25,1106.25,0.00,75963.00,75963.00,29,'2026-08-01 15:21:19',1,'2026-08-01 15:21:19','Customer changed their mind — piece returned to stock.',NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(12,NULL,1,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'draft','ready',110700.00,110100.00,600.00,0.00,0.00,0.00,3321.00,1660.50,1660.50,0.00,114021.00,0.00,NULL,NULL,NULL,NULL,NULL,'Held at the counter — customer is still deciding.',NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(13,NULL,2,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'draft','ready',160296.10,158325.50,1970.60,0.00,0.00,0.02,4808.88,2404.44,2404.44,0.00,165105.00,0.00,NULL,NULL,NULL,NULL,NULL,'Held at the counter — customer is still deciding.',NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(14,NULL,3,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'draft','ready',7888.10,6900.50,987.60,0.00,0.00,0.26,236.64,118.33,118.31,0.00,8125.00,0.00,NULL,NULL,NULL,NULL,NULL,'Held at the counter — customer is still deciding.',NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(15,'INV-2627-00012',5,NULL,NULL,'2026-08-01','exclusive',6,NULL,'final','ready',165244.80,155836.80,9408.00,0.00,0.00,-0.14,4957.34,2478.67,2478.67,0.00,170202.00,170202.00,31,'2026-08-01 15:21:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(16,'INV-2627-00013',NULL,NULL,NULL,'2026-08-02','exclusive',NULL,NULL,'final','ready',84191.02,78335.82,5855.20,0.00,0.00,0.25,2525.73,1262.87,1262.86,0.00,86717.00,86717.00,49,'2026-08-01 15:32:42',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2026-08-01 10:02:19','2026-08-01 10:02:42'),(17,'INV-2627-00014',1,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'final','ready',152096.66,140392.26,11704.40,0.00,0.00,0.34,0.00,0.00,0.00,0.00,152097.00,152097.00,51,'2026-08-01 15:37:46',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2026-08-01 10:07:46','2026-08-01 10:07:46'),(18,'INV-2627-00015',1,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'final','ready',210810.00,208710.00,2100.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,210810.00,210810.00,53,'2026-08-01 15:47:07',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-08-01 10:17:06','2026-08-01 10:17:07'),(19,'INV-2627-00016',9,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'final','ready',220200.00,220200.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,220200.00,0.00,60,'2026-08-01 16:29:07',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,'2026-08-01 10:59:07','2026-08-01 10:59:07'),(20,'INV-2627-00017',NULL,NULL,NULL,'2026-08-01','exclusive',NULL,NULL,'final','ready',222300.00,220200.00,2100.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,222300.00,222300.00,62,'2026-08-01 16:40:55',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,7,'2026-08-01 11:10:41','2026-08-01 11:10:55');
/*!40000 ALTER TABLE `invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ledger_accounts`
--

DROP TABLE IF EXISTS `ledger_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ledger_accounts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `group_id` int(10) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `code` varchar(30) DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `opening_type` enum('dr','cr') NOT NULL DEFAULT 'dr',
  `linked_type` enum('cash','bank','customer','vendor','gst_output','gst_input','inventory','sales','making','old_metal','expense','cogs','discount','round_off','opening_equity','stock_adjust') DEFAULT NULL,
  `linked_id` int(10) unsigned DEFAULT NULL,
  `metal` varchar(30) DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ledger_accounts_code` (`code`),
  KEY `idx_ledger_accounts_group` (`group_id`),
  KEY `idx_ledger_accounts_linked` (`linked_type`,`linked_id`),
  CONSTRAINT `fk_ledger_accounts_group` FOREIGN KEY (`group_id`) REFERENCES `account_groups` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ledger_accounts`
--

LOCK TABLES `ledger_accounts` WRITE;
/*!40000 ALTER TABLE `ledger_accounts` DISABLE KEYS */;
INSERT INTO `ledger_accounts` VALUES (1,5,'Cash in Hand',NULL,0.00,'dr','cash',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(2,5,'Bank Account',NULL,0.00,'dr','bank',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(3,6,'Inventory — Gold',NULL,0.00,'dr','inventory',NULL,'gold',1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(4,6,'Inventory — Silver',NULL,0.00,'dr','inventory',NULL,'silver',1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(5,6,'Inventory — Platinum',NULL,0.00,'dr','inventory',NULL,'platinum',1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(6,6,'Inventory — Old Metal',NULL,0.00,'dr','old_metal',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(7,7,'Walk-in Customers',NULL,0.00,'dr','customer',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(8,8,'GST Input (Purchases)',NULL,0.00,'dr','gst_input',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(9,9,'Sundry Creditors',NULL,0.00,'cr','vendor',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(10,10,'GST Payable',NULL,0.00,'cr','gst_output',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(11,11,'Opening Balances Equity',NULL,0.00,'cr','opening_equity',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(12,12,'Gold Sales',NULL,0.00,'cr','sales',NULL,'gold',1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(13,12,'Silver Sales',NULL,0.00,'cr','sales',NULL,'silver',1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(14,12,'Platinum Sales',NULL,0.00,'cr','sales',NULL,'platinum',1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(15,12,'Making Charges Income',NULL,0.00,'cr','making',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(16,13,'Round Off',NULL,0.00,'cr','round_off',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(17,13,'Discount Given',NULL,0.00,'dr','discount',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(18,14,'Cost of Goods Sold',NULL,0.00,'dr','cogs',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(19,15,'Wages & Karigar Charges',NULL,0.00,'dr','expense',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(20,15,'Stock Adjustment Loss',NULL,0.00,'dr','stock_adjust',NULL,NULL,1,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(21,9,'Vora Gold Refiners',NULL,0.00,'cr','vendor',1,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(22,9,'Shree Balaji Metals',NULL,0.00,'cr','vendor',2,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(23,9,'Sai Karigar Works',NULL,0.00,'cr','vendor',3,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(24,7,'Meera Shah',NULL,0.00,'dr','customer',1,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(25,7,'Rohit Mehta',NULL,0.00,'dr','customer',2,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(26,7,'Anita Verma',NULL,0.00,'dr','customer',3,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(27,7,'Priya Nair',NULL,0.00,'dr','customer',4,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(28,7,'Karan Patel',NULL,0.00,'dr','customer',5,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(29,7,'Sunita Desai',NULL,0.00,'dr','customer',6,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(30,7,'Vikram Singh',NULL,0.00,'dr','customer',7,NULL,1,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(31,7,'Deepa Iyer',NULL,0.00,'dr','customer',8,NULL,1,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(32,15,'Rent',NULL,0.00,'dr','expense',3,NULL,1,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(33,15,'Utilities',NULL,0.00,'dr','expense',4,NULL,1,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(34,15,'Karigar Charges',NULL,0.00,'dr','expense',5,NULL,1,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(35,15,'Marketing',NULL,0.00,'dr','expense',6,NULL,1,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(36,15,'Office Supplies',NULL,0.00,'dr','expense',7,NULL,1,1,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(37,9,'Patel Angadia Services',NULL,0.00,'cr','vendor',6,NULL,1,1,'2026-08-01 10:55:29','2026-08-01 10:55:29'),(38,7,'Joy',NULL,0.00,'dr','customer',9,NULL,1,1,'2026-08-01 10:59:07','2026-08-01 10:59:07');
/*!40000 ALTER TABLE `ledger_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `message_log`
--

DROP TABLE IF EXISTS `message_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `message_log` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `channel` enum('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  `template_id` int(10) unsigned DEFAULT NULL,
  `event` varchar(40) DEFAULT NULL,
  `recipient_name` varchar(150) DEFAULT NULL,
  `recipient_contact` varchar(190) DEFAULT NULL,
  `subject` varchar(190) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `status` enum('queued','sent','delivered','failed') NOT NULL DEFAULT 'queued',
  `related_type` varchar(40) DEFAULT NULL,
  `related_id` int(10) unsigned DEFAULT NULL,
  `error` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ml_status` (`status`),
  KEY `idx_ml_channel` (`channel`),
  KEY `idx_ml_created` (`created_at`),
  KEY `fk_ml_template` (`template_id`),
  CONSTRAINT `fk_ml_template` FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message_log`
--

LOCK TABLES `message_log` WRITE;
/*!40000 ALTER TABLE `message_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `message_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `message_templates`
--

DROP TABLE IF EXISTS `message_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `message_templates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `channel` enum('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  `event` enum('lead_followup','invoice_receipt','order_status','repair_status','appointment_reminder','birthday','anniversary','order_review','custom') NOT NULL DEFAULT 'custom',
  `subject` varchar(190) DEFAULT NULL,
  `body` text NOT NULL,
  `variables_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variables_json`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mt_channel` (`channel`),
  KEY `idx_mt_event` (`event`),
  KEY `fk_mt_creator` (`created_by`),
  CONSTRAINT `fk_mt_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message_templates`
--

LOCK TABLES `message_templates` WRITE;
/*!40000 ALTER TABLE `message_templates` DISABLE KEYS */;
/*!40000 ALTER TABLE `message_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metal_rates`
--

DROP TABLE IF EXISTS `metal_rates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `metal_rates` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `rate_date` date NOT NULL,
  `purity_id` int(10) unsigned NOT NULL,
  `rate_per_gram` decimal(12,2) NOT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_metal_rates_day` (`rate_date`,`purity_id`),
  KEY `idx_metal_rates_date` (`rate_date`),
  KEY `fk_metal_rates_purity` (`purity_id`),
  KEY `fk_metal_rates_creator` (`created_by`),
  CONSTRAINT `fk_metal_rates_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_metal_rates_purity` FOREIGN KEY (`purity_id`) REFERENCES `purities` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=187 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metal_rates`
--

LOCK TABLES `metal_rates` WRITE;
/*!40000 ALTER TABLE `metal_rates` DISABLE KEYS */;
INSERT INTO `metal_rates` VALUES (1,'2026-07-02',1,7372.96,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(2,'2026-07-02',2,6988.24,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(3,'2026-07-02',3,5604.05,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(4,'2026-07-02',4,99.85,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(5,'2026-07-02',5,92.92,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(6,'2026-07-03',1,7354.14,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(7,'2026-07-03',2,6970.40,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(8,'2026-07-03',3,5589.75,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(9,'2026-07-03',4,99.59,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(10,'2026-07-03',5,92.68,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(11,'2026-07-04',1,7334.63,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(12,'2026-07-04',2,6951.91,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(13,'2026-07-04',3,5574.92,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(14,'2026-07-04',4,99.33,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(15,'2026-07-04',5,92.43,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(16,'2026-07-05',1,7315.39,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(17,'2026-07-05',2,6933.67,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(18,'2026-07-05',3,5560.29,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(19,'2026-07-05',4,99.07,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(20,'2026-07-05',5,92.19,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(21,'2026-07-06',1,7297.35,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(22,'2026-07-06',2,6916.58,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(23,'2026-07-06',3,5546.59,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(24,'2026-07-06',4,98.82,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(25,'2026-07-06',5,91.96,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(26,'2026-07-07',1,7281.42,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(27,'2026-07-07',2,6901.47,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(28,'2026-07-07',3,5534.47,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(29,'2026-07-07',4,98.61,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(30,'2026-07-07',5,91.76,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(31,'2026-07-08',1,7268.36,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(32,'2026-07-08',2,6889.10,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(33,'2026-07-08',3,5524.55,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(34,'2026-07-08',4,98.43,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(35,'2026-07-08',5,91.60,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(36,'2026-07-09',1,7258.83,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(37,'2026-07-09',2,6880.06,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(38,'2026-07-09',3,5517.30,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(39,'2026-07-09',4,98.30,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(40,'2026-07-09',5,91.48,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(41,'2026-07-10',1,7253.29,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(42,'2026-07-10',2,6874.81,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(43,'2026-07-10',3,5513.09,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(44,'2026-07-10',4,98.23,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(45,'2026-07-10',5,91.41,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(46,'2026-07-11',1,7252.01,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(47,'2026-07-11',2,6873.60,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(48,'2026-07-11',3,5512.12,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(49,'2026-07-11',4,98.21,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(50,'2026-07-11',5,91.39,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(51,'2026-07-12',1,7255.06,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(52,'2026-07-12',2,6876.49,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(53,'2026-07-12',3,5514.44,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(54,'2026-07-12',4,98.25,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(55,'2026-07-12',5,91.43,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(56,'2026-07-13',1,7262.29,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(57,'2026-07-13',2,6883.35,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(58,'2026-07-13',3,5519.93,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(59,'2026-07-13',4,98.35,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(60,'2026-07-13',5,91.52,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(61,'2026-07-14',1,7273.34,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(62,'2026-07-14',2,6893.82,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(63,'2026-07-14',3,5528.33,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(64,'2026-07-14',4,98.50,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(65,'2026-07-14',5,91.66,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(66,'2026-07-15',1,7287.67,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(67,'2026-07-15',2,6907.40,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(68,'2026-07-15',3,5539.22,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(69,'2026-07-15',4,98.69,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(70,'2026-07-15',5,91.84,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(71,'2026-07-16',1,7304.57,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(72,'2026-07-16',2,6923.42,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(73,'2026-07-16',3,5552.07,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(74,'2026-07-16',4,98.92,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(75,'2026-07-16',5,92.05,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(76,'2026-07-17',1,7323.21,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(77,'2026-07-17',2,6941.09,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(78,'2026-07-17',3,5566.24,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(79,'2026-07-17',4,99.17,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(80,'2026-07-17',5,92.29,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(81,'2026-07-18',1,7342.68,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(82,'2026-07-18',2,6959.54,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(83,'2026-07-18',3,5581.04,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(84,'2026-07-18',4,99.44,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(85,'2026-07-18',5,92.53,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(86,'2026-07-19',1,7362.02,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(87,'2026-07-19',2,6977.87,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(88,'2026-07-19',3,5595.74,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(89,'2026-07-19',4,99.70,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(90,'2026-07-19',5,92.78,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(91,'2026-07-20',1,7380.28,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(92,'2026-07-20',2,6995.17,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(93,'2026-07-20',3,5609.61,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(94,'2026-07-20',4,99.95,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(95,'2026-07-20',5,93.01,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(96,'2026-07-21',1,7396.55,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(97,'2026-07-21',2,7010.60,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(98,'2026-07-21',3,5621.98,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(99,'2026-07-21',4,100.17,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(100,'2026-07-21',5,93.21,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(101,'2026-07-22',1,7410.04,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(102,'2026-07-22',2,7023.39,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(103,'2026-07-22',3,5632.24,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(104,'2026-07-22',4,100.35,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(105,'2026-07-22',5,93.38,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(106,'2026-07-23',1,7420.09,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(107,'2026-07-23',2,7032.91,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(108,'2026-07-23',3,5639.88,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(109,'2026-07-23',4,100.48,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(110,'2026-07-23',5,93.51,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(111,'2026-07-24',1,7426.20,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(112,'2026-07-24',2,7038.70,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(113,'2026-07-24',3,5644.52,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(114,'2026-07-24',4,100.57,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(115,'2026-07-24',5,93.59,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(116,'2026-07-25',1,7428.07,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(117,'2026-07-25',2,7040.47,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(118,'2026-07-25',3,5645.94,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(119,'2026-07-25',4,100.59,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(120,'2026-07-25',5,93.61,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(121,'2026-07-26',1,7425.61,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(122,'2026-07-26',2,7038.14,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(123,'2026-07-26',3,5644.07,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(124,'2026-07-26',4,100.56,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(125,'2026-07-26',5,93.58,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(126,'2026-07-27',1,7418.94,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(127,'2026-07-27',2,7031.82,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(128,'2026-07-27',3,5639.00,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(129,'2026-07-27',4,100.47,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(130,'2026-07-27',5,93.49,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(131,'2026-07-28',1,7408.38,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(132,'2026-07-28',2,7021.81,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(133,'2026-07-28',3,5630.98,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(134,'2026-07-28',4,100.33,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(135,'2026-07-28',5,93.36,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(136,'2026-07-29',1,7394.47,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(137,'2026-07-29',2,7008.62,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(138,'2026-07-29',3,5620.40,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(139,'2026-07-29',4,100.14,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(140,'2026-07-29',5,93.19,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(141,'2026-07-30',1,7377.87,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(142,'2026-07-30',2,6992.89,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(143,'2026-07-30',3,5607.78,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(144,'2026-07-30',4,99.91,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(145,'2026-07-30',5,92.98,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(146,'2026-07-31',1,7359.41,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(147,'2026-07-31',2,6975.40,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(148,'2026-07-31',3,5593.76,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(149,'2026-07-31',4,99.66,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(150,'2026-07-31',5,92.74,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(151,'2026-08-01',1,7340.00,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(152,'2026-08-01',2,6957.00,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(153,'2026-08-01',3,5579.00,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(154,'2026-08-01',4,99.40,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(155,'2026-08-01',5,92.50,1,'2026-08-01 09:51:17','2026-08-01 09:51:17'),(156,'2026-07-02',6,3360.02,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(157,'2026-07-03',6,3351.44,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(158,'2026-07-04',6,3342.55,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(159,'2026-07-05',6,3333.78,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(160,'2026-07-06',6,3325.57,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(161,'2026-07-07',6,3318.30,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(162,'2026-07-08',6,3312.35,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(163,'2026-07-09',6,3308.01,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(164,'2026-07-10',6,3305.48,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(165,'2026-07-11',6,3304.90,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(166,'2026-07-12',6,3306.29,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(167,'2026-07-13',6,3309.59,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(168,'2026-07-14',6,3314.62,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(169,'2026-07-15',6,3321.15,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(170,'2026-07-16',6,3328.85,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(171,'2026-07-17',6,3337.35,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(172,'2026-07-18',6,3346.22,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(173,'2026-07-19',6,3355.04,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(174,'2026-07-20',6,3363.35,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(175,'2026-07-21',6,3370.77,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(176,'2026-07-22',6,3376.92,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(177,'2026-07-23',6,3381.50,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(178,'2026-07-24',6,3384.28,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(179,'2026-07-25',6,3385.14,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(180,'2026-07-26',6,3384.01,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(181,'2026-07-27',6,3380.97,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(182,'2026-07-28',6,3376.16,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(183,'2026-07-29',6,3369.82,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(184,'2026-07-30',6,3362.26,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(185,'2026-07-31',6,3353.85,1,'2026-08-01 09:57:56','2026-08-01 09:57:56'),(186,'2026-08-01',6,3345.00,1,'2026-08-01 09:57:56','2026-08-01 09:57:56');
/*!40000 ALTER TABLE `metal_rates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metals`
--

DROP TABLE IF EXISTS `metals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `metals` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(30) NOT NULL,
  `name` varchar(60) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_metals_code` (`code`),
  KEY `fk_metals_creator` (`created_by`),
  CONSTRAINT `fk_metals_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metals`
--

LOCK TABLES `metals` WRITE;
/*!40000 ALTER TABLE `metals` DISABLE KEYS */;
INSERT INTO `metals` VALUES (1,'gold','Gold',1,1,NULL,'2026-08-01 09:51:17'),(2,'silver','Silver',2,1,NULL,'2026-08-01 09:51:17'),(3,'platinum','Platinum',3,1,NULL,'2026-08-01 09:51:17');
/*!40000 ALTER TABLE `metals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `type` varchar(80) NOT NULL,
  `title` varchar(150) NOT NULL,
  `body` varchar(500) DEFAULT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` int(10) unsigned DEFAULT NULL,
  `link_url` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`,`is_read`),
  KEY `idx_notifications_created` (`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `number_sequences`
--

DROP TABLE IF EXISTS `number_sequences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `number_sequences` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `seq_key` varchar(30) NOT NULL,
  `period` varchar(10) NOT NULL DEFAULT '',
  `prefix` varchar(10) NOT NULL,
  `next_number` int(10) unsigned NOT NULL DEFAULT 1,
  `padding` tinyint(3) unsigned NOT NULL DEFAULT 5,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sequence` (`seq_key`,`period`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `number_sequences`
--

LOCK TABLES `number_sequences` WRITE;
/*!40000 ALTER TABLE `number_sequences` DISABLE KEYS */;
INSERT INTO `number_sequences` VALUES (1,'invoice','2627','INV-',18,5),(2,'estimate','2627','EST-',7,5),(3,'receipt','2627','RCPT-',17,5),(4,'purchase','2627','PUR-',8,5),(5,'vendor_payment','2627','PAY-',7,5),(6,'voucher','2627','VCH-',62,5),(7,'customer','','CUST-',10,4),(8,'vendor','','VEN-',1,4),(9,'item_rm','','RM-',5,4),(10,'item_st','','ST-',44,4),(11,'adjustment','','ADJ-',5,4);
/*!40000 ALTER TABLE `number_sequences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_otps`
--

DROP TABLE IF EXISTS `password_reset_otps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_otps` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `reset_token_hash` char(64) DEFAULT NULL,
  `attempts` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_otps_user` (`user_id`),
  CONSTRAINT `fk_otps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_otps`
--

LOCK TABLES `password_reset_otps` WRITE;
/*!40000 ALTER TABLE `password_reset_otps` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_otps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `permissions` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `resource` varchar(60) NOT NULL,
  `action` varchar(40) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permission` (`resource`,`action`)
) ENGINE=InnoDB AUTO_INCREMENT=442 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'dashboard','read','See the dashboard',1),(2,'reports','read','See general reports',1),(3,'reports','pnl','See profit & loss',1),(4,'reports','accounting','See trial balance, day book & ledgers',1),(5,'reports','gst','See the GST summary',1),(6,'reports','outstanding','See who owes money',1),(7,'reports','stock','See stock reports and item cost',1),(8,'customers','read','See customers',1),(9,'customers','create','Add a customer',1),(10,'customers','update','Edit a customer',1),(11,'customers','delete','Remove a customer',1),(12,'customers','ledger','See a customer\'s account statement',1),(13,'invoices','read','See bills',1),(14,'invoices','create','Make a bill',1),(15,'invoices','override','Change rate, making or tax on a bill',1),(16,'invoices','cancel','Cancel a bill',1),(17,'estimates','read','See estimates',1),(18,'estimates','create','Make an estimate',1),(19,'payments','read','See payments',1),(20,'payments','create','Take money from a customer',1),(21,'payments','vendor','Pay a vendor',1),(22,'payments','cancel','Cancel a payment',1),(23,'purchases','read','See purchases',1),(24,'purchases','create','Record a purchase',1),(25,'purchases','cancel','Cancel a purchase',1),(26,'expenses','read','See expenses',1),(27,'expenses','create','Add an expense',1),(28,'expenses','update','Edit an expense',1),(29,'expenses','delete','Remove an expense',1),(30,'bank_accounts','manage','Manage bank accounts',1),(31,'inventory','read','See stock and items',1),(32,'inventory','manage','Add and edit items',1),(33,'inventory','adjust','Adjust stock',1),(34,'inventory','issue','Issue stock',1),(35,'inventory','opening','Enter opening stock',1),(36,'rates','read','See today\'s rates',1),(37,'rates','set','Set today\'s gold & silver rates',1),(38,'vendors','read','See vendors',1),(39,'vendors','manage','Add and edit vendors',1),(40,'vendors','ledger','See a vendor\'s account statement',1),(41,'accounting','read','Open the Accounts section',1),(42,'accounting','manage','Add and edit ledger accounts',1),(43,'accounting','journal','Pass a manual journal entry',1),(44,'users','read','See users',1),(45,'users','manage','Add and edit users',1),(46,'rbac','manage','Manage roles & permissions',1),(47,'settings','read','See settings',1),(48,'settings','manage','Change shop settings',1),(49,'audit','read','See the audit log',1);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_items`
--

DROP TABLE IF EXISTS `purchase_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchase_items` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `purchase_id` int(10) unsigned NOT NULL,
  `item_id` int(10) unsigned DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `metal` varchar(30) DEFAULT NULL,
  `purity_id` int(10) unsigned DEFAULT NULL,
  `qty` decimal(12,3) NOT NULL,
  `weight` decimal(10,3) NOT NULL DEFAULT 0.000,
  `rate_per_gram` decimal(12,2) NOT NULL DEFAULT 0.00,
  `making_charge` decimal(12,2) NOT NULL DEFAULT 0.00,
  `rate` decimal(12,2) NOT NULL,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchase_items_purchase` (`purchase_id`),
  KEY `idx_purchase_items_item` (`item_id`),
  KEY `fk_purchase_items_purity` (`purity_id`),
  CONSTRAINT `fk_purchase_items_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_purchase_items_purity` FOREIGN KEY (`purity_id`) REFERENCES `purities` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_items`
--

LOCK TABLES `purchase_items` WRITE;
/*!40000 ALTER TABLE `purchase_items` DISABLE KEYS */;
INSERT INTO `purchase_items` VALUES (1,1,287,'Gold Bangle Pair — antique finish','gold',2,1.000,41.200,6510.00,0.00,6510.00,3.00,8046.36,276258.36),(2,1,288,'Gold Kada — plain','gold',2,1.000,35.100,6510.00,0.00,6510.00,3.00,6855.03,235356.03),(3,1,289,'Gold Chain 20\" — rope','gold',2,1.000,24.360,6510.00,0.00,6510.00,3.00,4757.51,163341.11),(4,1,290,'Gold Chain 24\" — box','gold',2,1.000,31.180,6510.00,0.00,6510.00,3.00,6089.45,209071.25),(5,1,291,'Bridal Necklace Set — temple','gold',2,1.000,82.640,6510.00,0.00,6510.00,3.00,16139.59,554125.99),(6,1,292,'Gold Necklace — kundan','gold',2,1.000,49.300,6510.00,0.00,6510.00,3.00,9628.29,330571.29),(7,1,293,'Jhumka Earrings — temple design','gold',2,1.000,17.240,6510.00,0.00,6510.00,3.00,3366.97,115599.37),(8,1,294,'Stud Earrings — daily wear','gold',3,1.000,6.220,5240.00,0.00,5240.00,3.00,977.78,33570.58),(9,1,295,'Diamond Solitaire Ring','gold',3,1.000,4.100,5240.00,0.00,5240.00,3.00,644.52,22128.52),(10,1,296,'Gold 24K bullion','gold',1,1.000,250.000,6960.00,0.00,6960.00,3.00,52200.00,1792200.00),(11,2,297,'Gents Ring — signet','gold',2,1.000,9.860,6510.00,0.00,6510.00,3.00,1925.66,66114.26),(12,2,298,'Ladies Ring — floral','gold',3,1.000,3.960,5240.00,0.00,5240.00,3.00,622.51,21372.91),(13,2,299,'Pendant — Ganesh','gold',2,1.000,7.640,6510.00,0.00,6510.00,3.00,1492.09,51228.49),(14,2,300,'Pendant Set with chain','gold',3,1.000,11.480,5240.00,0.00,5240.00,3.00,1804.66,61959.86),(15,2,301,'Gold Bracelet — cuban link','gold',2,1.000,22.740,6510.00,0.00,6510.00,3.00,4441.12,152478.52),(16,2,302,'Gold Coin 10 g — 999','gold',1,1.000,10.000,6960.00,0.00,6960.00,3.00,2088.00,71688.00),(17,2,303,'Gold Coin 5 g — 999','gold',1,1.000,5.000,6960.00,0.00,6960.00,3.00,1044.00,35844.00),(18,2,304,'Gold Bar 20 g — 999','gold',1,1.000,20.000,6960.00,0.00,6960.00,3.00,4176.00,143376.00),(19,2,305,'Silver 999 bullion','silver',4,1.000,3200.000,93.00,0.00,93.00,3.00,8928.00,306528.00),(20,3,306,'Silver Payal Pair — ghungroo','silver',5,1.000,124.600,86.00,0.00,86.00,3.00,321.47,11037.07),(21,3,307,'Silver Bracelet — oxidised','silver',5,1.000,46.200,86.00,0.00,86.00,3.00,119.20,4092.40),(22,3,308,'Silver Chain — 18\"','silver',5,1.000,28.400,86.00,0.00,86.00,3.00,73.27,2515.67),(23,3,309,'Silver Pooja Coin 20 g','silver',4,1.000,20.000,93.00,0.00,93.00,3.00,55.80,1915.80),(24,3,310,'Silver Toe Ring Set','silver',5,1.000,12.800,86.00,0.00,86.00,3.00,33.02,1133.82),(25,3,311,'Gold Mangalsutra — short','gold',2,1.000,16.240,6510.00,0.00,6510.00,3.00,3171.67,108894.07),(26,3,312,'Gold Nose Pin','gold',3,1.000,1.180,5240.00,0.00,5240.00,3.00,185.50,6368.70),(27,4,313,'Gold Bangle — single, machine cut','gold',2,1.000,19.780,6510.00,0.00,6510.00,3.00,3863.03,132630.83),(28,4,314,'Gold Bangle Set of 4 — thin','gold',2,1.000,28.640,6510.00,0.00,6510.00,3.00,5593.39,192039.79),(29,4,315,'Gold Chain 18\" — figaro','gold',2,1.000,18.920,6510.00,0.00,6510.00,3.00,3695.08,126864.28),(30,4,316,'Gold Haar — long rani','gold',2,1.000,91.400,6510.00,0.00,6510.00,3.00,17850.42,612864.42),(31,4,317,'Choker Necklace — polki','gold',3,1.000,38.200,5240.00,0.00,5240.00,3.00,6005.04,206173.04),(32,4,318,'Chandbali Earrings — 22K','gold',2,1.000,20.180,6510.00,0.00,6510.00,3.00,3941.15,135312.95),(33,4,319,'Hoop Earrings — 18K','gold',3,1.000,4.860,5240.00,0.00,5240.00,3.00,763.99,26230.39),(34,4,320,'Cocktail Ring — CZ','gold',3,1.000,5.940,5240.00,0.00,5240.00,3.00,933.77,32059.37),(35,4,321,'Engagement Ring — solitaire 0.5ct','gold',3,1.000,3.680,5240.00,0.00,5240.00,3.00,578.50,19861.70),(36,4,322,'Baby Bangle Pair — 22K','gold',2,1.000,11.260,6510.00,0.00,6510.00,3.00,2199.08,75501.68),(37,4,323,'Gold Coin 2 g — 999','gold',1,1.000,2.000,6960.00,0.00,6960.00,3.00,417.60,14337.60),(38,4,324,'Silver Dinner Set — 6 pc','silver',5,1.000,860.000,86.00,0.00,86.00,3.00,2218.80,76178.80),(39,4,325,'Silver Kumkum Box','silver',5,1.000,96.400,86.00,0.00,86.00,3.00,248.71,8539.11),(40,4,326,'Silver Anklet — kids','silver',5,1.000,34.200,86.00,0.00,86.00,3.00,88.24,3029.44),(41,4,327,'Gold 22K bullion','gold',2,1.000,180.000,6510.00,0.00,6510.00,3.00,35154.00,1206954.00),(42,5,NULL,'Making charges — bridal set',NULL,NULL,1.000,0.000,0.00,0.00,0.00,5.00,2425.00,50925.00),(43,5,NULL,'Polishing & finishing — 14 pieces',NULL,NULL,1.000,0.000,0.00,0.00,0.00,5.00,490.00,10290.00),(44,6,330,'Gold Ring','gold',1,1.000,20.000,7340.00,0.00,7340.00,3.00,4404.00,151204.00),(45,7,331,'Gold Ring','gold',1,1.000,30.000,7340.00,0.00,7340.00,3.00,6606.00,226806.00);
/*!40000 ALTER TABLE `purchase_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchases`
--

DROP TABLE IF EXISTS `purchases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purchases` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `purchase_no` varchar(30) NOT NULL,
  `supplier_id` int(10) unsigned NOT NULL,
  `purchase_date` date NOT NULL,
  `status` enum('draft','received','cancelled') NOT NULL DEFAULT 'received',
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `round_off` decimal(6,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `payment_status` enum('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  `payment_mode` enum('cash','bank','upi','cheque','card') DEFAULT NULL,
  `bank_account_id` int(10) unsigned DEFAULT NULL,
  `expense_id` int(10) unsigned DEFAULT NULL,
  `invoice_ref` varchar(60) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purchases_no` (`purchase_no`),
  KEY `idx_purchases_supplier` (`supplier_id`),
  KEY `idx_purchases_status` (`status`),
  KEY `idx_purchases_date` (`purchase_date`),
  KEY `idx_purchases_expense` (`expense_id`),
  KEY `idx_purchases_bank` (`bank_account_id`),
  KEY `fk_purchases_creator` (`created_by`),
  KEY `idx_purchases_voucher` (`voucher_id`),
  CONSTRAINT `fk_purchases_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_purchases_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_purchases_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_purchases_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchases`
--

LOCK TABLES `purchases` WRITE;
/*!40000 ALTER TABLE `purchases` DISABLE KEYS */;
INSERT INTO `purchases` VALUES (1,'PUR-2627-00001',1,'2026-07-18','received',3623517.00,108705.50,54352.75,54352.75,0.00,0.50,3732223.00,3732223.00,1,'unpaid',NULL,NULL,NULL,'VGR/26-27/0412','Stock replenishment',NULL,1,'2026-08-01 09:51:17','2026-08-01 09:51:18'),(2,'PUR-2627-00002',2,'2026-07-25','received',884068.00,26522.04,13261.02,13261.02,0.00,-0.04,910590.00,546354.00,2,'unpaid',NULL,NULL,NULL,'SBM/26-27/1188','Stock replenishment',NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(3,'PUR-2627-00003',1,'2026-07-30','received',131997.60,3959.93,1979.97,1979.96,0.00,0.47,135958.00,0.00,3,'unpaid',NULL,NULL,NULL,'VGR/26-27/0455','Stock replenishment',NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(4,'PUR-2627-00004',2,'2026-07-31','received',2785026.60,83550.80,41775.40,41775.40,0.00,-0.40,2868577.00,2868577.00,4,'unpaid',NULL,NULL,NULL,'SBM/26-27/1204','Stock replenishment',NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(5,'PUR-2627-00005',3,'2026-07-27','received',58300.00,2915.00,1457.50,1457.50,0.00,0.00,61215.00,30607.50,5,'unpaid',NULL,NULL,NULL,'JOB/2026/318','Karigar job work for the month',NULL,1,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(6,'PUR-2627-00006',6,'2026-08-01','received',146800.00,4404.00,2202.00,2202.00,0.00,0.00,151204.00,151204.00,55,'unpaid',NULL,NULL,NULL,NULL,NULL,NULL,2,'2026-08-01 10:55:29','2026-08-01 10:55:29'),(7,'PUR-2627-00007',6,'2026-08-01','received',220200.00,6606.00,3303.00,3303.00,0.00,0.00,226806.00,226806.00,57,'unpaid',NULL,NULL,NULL,NULL,NULL,NULL,2,'2026-08-01 10:56:40','2026-08-01 10:56:40');
/*!40000 ALTER TABLE `purchases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purities`
--

DROP TABLE IF EXISTS `purities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `purities` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `metal` varchar(30) NOT NULL,
  `code` varchar(10) NOT NULL,
  `label` varchar(40) NOT NULL,
  `fineness` decimal(6,4) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_purities_code` (`metal`,`code`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purities`
--

LOCK TABLES `purities` WRITE;
/*!40000 ALTER TABLE `purities` DISABLE KEYS */;
INSERT INTO `purities` VALUES (1,'gold','24K','24 Karat (999)',0.9990,1,1),(2,'gold','22K','22 Karat (916)',0.9160,2,1),(3,'gold','18K','18 Karat (750)',0.7500,3,1),(4,'silver','999','Fine Silver (999)',0.9990,4,1),(5,'silver','925','Sterling Silver (925)',0.9250,5,1),(6,'platinum','PT950','Platinum 950',0.9500,6,1);
/*!40000 ALTER TABLE `purities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permission_grants`
--

DROP TABLE IF EXISTS `role_permission_grants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_permission_grants` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` int(10) unsigned NOT NULL,
  `permission_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grant` (`role_id`,`permission_id`),
  KEY `idx_grant_permission` (`permission_id`),
  CONSTRAINT `fk_grants_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_grants_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=587 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permission_grants`
--

LOCK TABLES `role_permission_grants` WRITE;
/*!40000 ALTER TABLE `role_permission_grants` DISABLE KEYS */;
INSERT INTO `role_permission_grants` VALUES (526,2,1),(527,2,2),(528,2,4),(529,2,5),(530,2,6),(531,2,7),(532,2,8),(533,2,9),(534,2,10),(535,2,12),(539,2,13),(540,2,14),(541,2,15),(542,2,16),(543,2,17),(544,2,18),(545,2,19),(546,2,20),(547,2,21),(548,2,22),(549,2,23),(550,2,24),(551,2,25),(552,2,26),(553,2,27),(554,2,28),(555,2,29),(556,2,30),(560,2,31),(561,2,36),(536,2,38),(537,2,39),(538,2,40),(557,2,41),(558,2,42),(559,2,43),(562,3,1),(563,3,8),(564,3,9),(565,3,13),(566,3,14),(567,3,17),(568,3,18),(569,3,19),(570,3,20),(571,3,31),(572,3,36),(573,4,1),(584,4,2),(585,4,7),(586,4,8),(582,4,23),(583,4,24),(574,4,31),(575,4,32),(576,4,33),(577,4,34),(578,4,35),(579,4,36),(580,4,37),(581,4,38);
/*!40000 ALTER TABLE `role_permission_grants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(60) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `data_scope` enum('all','own') NOT NULL DEFAULT 'all',
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'super_admin','Owner',NULL,'all',1,1,'2026-07-28 13:25:20'),(2,'accountant','Accountant',NULL,'all',0,1,'2026-07-28 13:25:20'),(3,'cashier','Cashier',NULL,'all',0,1,'2026-07-28 13:25:20'),(4,'inventory','Inventory Manager',NULL,'all',0,1,'2026-07-28 13:25:20');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `security_audit_logs`
--

DROP TABLE IF EXISTS `security_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `security_audit_logs` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned DEFAULT NULL,
  `event` varchar(60) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sec_audit_user` (`user_id`),
  KEY `idx_sec_audit_event` (`event`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `security_audit_logs`
--

LOCK TABLES `security_audit_logs` WRITE;
/*!40000 ALTER TABLE `security_audit_logs` DISABLE KEYS */;
INSERT INTO `security_audit_logs` VALUES (1,2,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 09:52:56'),(2,7,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 09:53:05'),(3,1,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 09:53:15'),(4,7,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 10:08:16'),(5,1,'refresh.reuse','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 10:10:35'),(6,1,'login.failed','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"identifier\":\"admin\"}','2026-08-01 10:10:48'),(7,1,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 10:10:55'),(8,7,'login.failed','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','{\"identifier\":\"Admin\"}','2026-08-01 10:57:17'),(9,7,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 10:57:28'),(10,2,'refresh.reuse','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 11:13:56'),(11,7,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 11:19:13'),(12,2,'login.success','::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',NULL,'2026-08-01 11:19:22');
/*!40000 ALTER TABLE `security_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `settings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `skey` varchar(60) NOT NULL,
  `svalue` longtext DEFAULT NULL,
  `updated_by` int(10) unsigned DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settings_key` (`skey`),
  KEY `fk_settings_user` (`updated_by`),
  CONSTRAINT `fk_settings_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES (1,'company_name','Mahalakshmi Jewellers',NULL,'2026-08-01 09:51:17'),(2,'company_address','',NULL,'2026-08-01 09:51:17'),(3,'company_phone','',NULL,'2026-08-01 09:51:17'),(4,'company_email','',NULL,'2026-08-01 09:51:17'),(5,'company_gstin','',NULL,'2026-08-01 09:51:17'),(6,'default_tax_rate','3',NULL,'2026-08-01 09:51:17'),(7,'making_tax_rate','5',NULL,'2026-08-01 09:51:17'),(8,'dead_stock_days','180',NULL,'2026-08-01 09:51:17'),(9,'backdate_limit_days','3',NULL,'2026-08-01 09:51:17'),(10,'estimate_validity_days','7',NULL,'2026-08-01 09:51:17'),(11,'invoice_terms','Goods once sold will not be taken back or exchanged.',NULL,'2026-08-01 09:51:17'),(12,'invoice_footer_note','Thank you for your visit!',NULL,'2026-08-01 09:51:17'),(13,'currency','INR',NULL,'2026-08-01 09:51:17'),(14,'demo_seeded_at','2026-08-01 15:21:19',NULL,'2026-08-01 09:51:19');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `suppliers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_code` varchar(20) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `vendor_type` varchar(30) NOT NULL DEFAULT 'other',
  `company` varchar(150) DEFAULT NULL,
  `contact_person` varchar(120) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `pan_no` varchar(15) DEFAULT NULL,
  `bank_name` varchar(120) DEFAULT NULL,
  `account_no` varchar(40) DEFAULT NULL,
  `ifsc` varchar(20) DEFAULT NULL,
  `upi` varchar(80) DEFAULT NULL,
  `payment_terms` varchar(120) DEFAULT NULL,
  `specialisation` varchar(120) DEFAULT NULL,
  `karigar_rate` decimal(12,2) DEFAULT NULL,
  `vendor_status` enum('active','inactive','blacklisted') NOT NULL DEFAULT 'active',
  `mobile` varchar(20) DEFAULT NULL,
  `whatsapp` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `opening_type` enum('dr','cr') NOT NULL DEFAULT 'cr',
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pincode` varchar(12) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_code` (`vendor_code`),
  KEY `fk_suppliers_creator` (`created_by`),
  CONSTRAINT `fk_suppliers_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES (1,NULL,'Vora Gold Refiners','bullion','Vora Gold Refiners Pvt Ltd','Jayesh Vora','27AABCV2233K1Z5',NULL,NULL,NULL,NULL,NULL,'15 days credit',NULL,NULL,'active','9821330011',NULL,NULL,NULL,0.00,'cr','Mumbai','Maharashtra',NULL,NULL,1,1,'2026-08-01 09:51:17'),(2,NULL,'Shree Balaji Metals','bullion',NULL,'Mahesh Agarwal','27AAGCS8899P1Z2',NULL,NULL,NULL,NULL,NULL,'7 days credit',NULL,NULL,'active','9821330022',NULL,NULL,NULL,0.00,'cr','Mumbai','Maharashtra',NULL,NULL,1,1,'2026-08-01 09:51:17'),(3,NULL,'Sai Karigar Works','karigar',NULL,'Ramu Sonar',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Temple & antique jewellery',550.00,'active','9821330033',NULL,NULL,NULL,0.00,'cr','Mumbai','Maharashtra',NULL,NULL,1,1,'2026-08-01 09:51:17'),(4,NULL,'Shree Jewel Craft','karigar',NULL,'Dinesh Soni',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'Stone setting & polish',480.00,'active','9821330044',NULL,NULL,NULL,0.00,'cr','Thane','Maharashtra',NULL,NULL,1,1,'2026-08-01 09:51:17'),(5,NULL,'Ratna Gems','stone',NULL,'Paresh Jhaveri',NULL,NULL,NULL,NULL,NULL,NULL,'30 days credit',NULL,NULL,'active','9821330055',NULL,NULL,NULL,0.00,'cr','Surat','Gujarat',NULL,NULL,1,1,'2026-08-01 09:51:17'),(6,NULL,'Patel Angadia Services','angadia_courier',NULL,'Bharat Patel',NULL,NULL,NULL,NULL,NULL,NULL,'On delivery',NULL,NULL,'active','9821330066',NULL,NULL,NULL,0.00,'cr','Mumbai','Maharashtra',NULL,'Weekly Mumbai–Surat–Rajkot run for stones and job-work pieces.',1,1,'2026-08-01 09:51:17');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `units`
--

DROP TABLE IF EXISTS `units`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `units` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `short_name` varchar(10) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_units_name` (`name`),
  UNIQUE KEY `uq_units_short` (`short_name`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `units`
--

LOCK TABLES `units` WRITE;
/*!40000 ALTER TABLE `units` DISABLE KEYS */;
INSERT INTO `units` VALUES (1,'Pieces','pcs',1),(2,'Gram','g',1),(3,'Kilogram','kg',1),(4,'Carat','ct',1),(5,'Set','set',1);
/*!40000 ALTER TABLE `units` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_role_assignments`
--

DROP TABLE IF EXISTS `user_role_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_role_assignments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `role_id` int(10) unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `expires_at` datetime DEFAULT NULL,
  `assigned_by` int(10) unsigned DEFAULT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_assignment` (`user_id`,`role_id`),
  KEY `idx_assignment_role` (`role_id`),
  KEY `fk_assignments_assigner` (`assigned_by`),
  CONSTRAINT `fk_assignments_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_assignments_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_assignments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_role_assignments`
--

LOCK TABLES `user_role_assignments` WRITE;
/*!40000 ALTER TABLE `user_role_assignments` DISABLE KEYS */;
INSERT INTO `user_role_assignments` VALUES (1,1,1,1,NULL,NULL,'2026-07-28 13:25:20'),(2,2,2,1,NULL,1,'2026-07-29 03:06:43'),(8,7,1,1,NULL,NULL,'2026-07-29 09:31:49');
/*!40000 ALTER TABLE `user_role_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `avatar_color` varchar(7) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `last_login_at` datetime DEFAULT NULL,
  `password_changed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','$2y$10$jMZmF10ipa66Jmahj2TYne8vN6dy2oV0dFkl8o4CtpW1S.qrbqsK2','Owner','admin@jewellers.local',NULL,'#B8860B',1,0,'2026-08-01 15:40:55','2026-07-29 11:32:09','2026-07-28 13:25:20','2026-08-01 10:10:55'),(2,'Accountant','$2y$10$4sQh7hQCFNJgJ/28kKXXJ.cKgbXuKayhltEX/3Vlv07YR5DcZ0k1W','Accountant',NULL,NULL,'#3FD16F',1,0,'2026-08-01 16:49:22','2026-07-29 08:37:17','2026-07-29 03:06:43','2026-08-01 11:19:22'),(7,'Admin','$2y$10$IP6xFqAG5kGUXNHRKIrlWe1HKA5qAWn.9jqD5mfI0MSXCjJ6dAX1G','Administrator','administrator@jewellers.local',NULL,'#6C63FF',1,0,'2026-08-01 16:49:13','2026-07-29 15:06:58','2026-07-29 09:31:49','2026-08-01 11:19:13');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_payments`
--

DROP TABLE IF EXISTS `vendor_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendor_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `payment_no` varchar(30) NOT NULL,
  `supplier_id` int(10) unsigned NOT NULL,
  `purchase_id` int(10) unsigned DEFAULT NULL,
  `payment_date` date NOT NULL,
  `payment_mode` enum('cash','bank','upi','cheque','card') NOT NULL DEFAULT 'cash',
  `bank_account_id` int(10) unsigned DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `ref_no` varchar(60) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `voucher_id` int(10) unsigned DEFAULT NULL,
  `status` enum('active','cancelled') NOT NULL DEFAULT 'active',
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_payments_no` (`payment_no`),
  KEY `idx_vendor_payments_supplier` (`supplier_id`,`status`),
  KEY `idx_vendor_payments_purchase` (`purchase_id`),
  KEY `fk_vendor_payments_voucher` (`voucher_id`),
  KEY `fk_vendor_payments_creator` (`created_by`),
  CONSTRAINT `fk_vendor_payments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vendor_payments_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_vendor_payments_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`),
  CONSTRAINT `fk_vendor_payments_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_payments`
--

LOCK TABLES `vendor_payments` WRITE;
/*!40000 ALTER TABLE `vendor_payments` DISABLE KEYS */;
INSERT INTO `vendor_payments` VALUES (1,'PAY-2627-00001',1,1,'2026-07-31','bank',1,3732223.00,'NEFT830041','Bill settled in full',6,'active',1,'2026-08-01 09:51:18'),(2,'PAY-2627-00002',2,2,'2026-07-31','upi',NULL,546354.00,'NEFT830042','Part payment',7,'active',1,'2026-08-01 09:51:18'),(3,'PAY-2627-00003',2,4,'2026-07-31','bank',1,2868577.00,'NEFT830044','Bill settled in full',8,'active',1,'2026-08-01 09:51:18'),(4,'PAY-2627-00004',3,5,'2026-07-31','upi',NULL,30607.50,'NEFT830045','Part payment',9,'active',1,'2026-08-01 09:51:18'),(5,'PAY-2627-00005',6,6,'2026-08-01','cash',NULL,151204.00,NULL,NULL,56,'active',2,'2026-08-01 10:55:29'),(6,'PAY-2627-00006',6,7,'2026-08-01','upi',NULL,226806.00,NULL,NULL,58,'active',2,'2026-08-01 10:56:40');
/*!40000 ALTER TABLE `vendor_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_types`
--

DROP TABLE IF EXISTS `vendor_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vendor_types` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(30) NOT NULL,
  `label` varchar(60) NOT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vendor_types_slug` (`slug`),
  KEY `fk_vendor_types_creator` (`created_by`),
  CONSTRAINT `fk_vendor_types_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_types`
--

LOCK TABLES `vendor_types` WRITE;
/*!40000 ALTER TABLE `vendor_types` DISABLE KEYS */;
INSERT INTO `vendor_types` VALUES (2,'angadia_courier','Angadia / Courier',1,'2026-08-01 09:42:59');
/*!40000 ALTER TABLE `vendor_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voucher_entries`
--

DROP TABLE IF EXISTS `voucher_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voucher_entries` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `voucher_id` int(10) unsigned NOT NULL,
  `ledger_id` int(10) unsigned NOT NULL,
  `dr_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `cr_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `narration` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_voucher_entries_voucher` (`voucher_id`),
  KEY `idx_voucher_entries_ledger` (`ledger_id`),
  CONSTRAINT `fk_voucher_entries_ledger` FOREIGN KEY (`ledger_id`) REFERENCES `ledger_accounts` (`id`),
  CONSTRAINT `fk_voucher_entries_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=231 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voucher_entries`
--

LOCK TABLES `voucher_entries` WRITE;
/*!40000 ALTER TABLE `voucher_entries` DISABLE KEYS */;
INSERT INTO `voucher_entries` VALUES (1,1,3,3623517.00,0.00,NULL),(2,1,8,108705.50,0.00,NULL),(3,1,16,0.50,0.00,NULL),(4,1,21,0.00,3732223.00,NULL),(5,2,3,586468.00,0.00,NULL),(6,2,4,297600.00,0.00,NULL),(7,2,8,26522.04,0.00,NULL),(8,2,16,0.00,0.04,NULL),(9,2,22,0.00,910590.00,NULL),(10,3,4,20092.00,0.00,NULL),(11,3,3,111905.60,0.00,NULL),(12,3,8,3959.93,0.00,NULL),(13,3,16,0.47,0.00,NULL),(14,3,21,0.00,135958.00,NULL),(15,4,3,2699835.00,0.00,NULL),(16,4,4,85191.60,0.00,NULL),(17,4,8,83550.80,0.00,NULL),(18,4,16,0.00,0.40,NULL),(19,4,22,0.00,2868577.00,NULL),(20,5,19,58300.00,0.00,NULL),(21,5,8,2915.00,0.00,NULL),(22,5,23,0.00,61215.00,NULL),(23,6,21,3732223.00,0.00,NULL),(24,6,2,0.00,3732223.00,NULL),(25,7,22,546354.00,0.00,NULL),(26,7,2,0.00,546354.00,NULL),(27,8,22,2868577.00,0.00,NULL),(28,8,2,0.00,2868577.00,NULL),(29,9,23,30607.50,0.00,NULL),(30,9,2,0.00,30607.50,NULL),(31,10,24,591907.00,0.00,NULL),(32,10,17,1500.00,0.00,NULL),(33,10,12,0.00,533731.47,NULL),(34,10,15,0.00,42392.00,NULL),(35,10,10,0.00,17283.70,NULL),(36,10,16,0.17,0.00,NULL),(37,10,18,496713.00,0.00,NULL),(38,10,3,0.00,496713.00,NULL),(39,11,2,591907.00,0.00,NULL),(40,11,24,0.00,591907.00,NULL),(41,12,7,186761.00,0.00,NULL),(42,12,12,0.00,171089.78,NULL),(43,12,15,0.00,10231.20,NULL),(44,12,10,0.00,5439.63,NULL),(45,12,16,0.00,0.39,NULL),(46,12,18,158583.60,0.00,NULL),(47,12,3,0.00,158583.60,NULL),(48,13,1,186761.00,0.00,NULL),(49,13,7,0.00,186761.00,NULL),(50,14,25,769298.00,0.00,NULL),(51,14,6,135762.45,0.00,NULL),(52,14,12,0.00,801144.84,NULL),(53,14,15,0.00,77554.80,NULL),(54,14,10,0.00,26360.99,NULL),(55,14,16,0.18,0.00,NULL),(56,14,18,740968.20,0.00,NULL),(57,14,3,0.00,740968.20,NULL),(58,15,1,346184.10,0.00,NULL),(59,15,25,0.00,346184.10,NULL),(60,16,2,230789.40,0.00,NULL),(61,16,25,0.00,230789.40,NULL),(62,17,26,387480.00,0.00,NULL),(63,17,17,1500.00,0.00,NULL),(64,17,12,0.00,336874.08,NULL),(65,17,15,0.00,40776.70,NULL),(66,17,10,0.00,11329.52,NULL),(67,17,16,0.30,0.00,NULL),(68,17,18,320943.00,0.00,NULL),(69,17,3,0.00,320943.00,NULL),(70,18,2,387480.00,0.00,NULL),(71,18,26,0.00,387480.00,NULL),(72,19,27,134632.00,0.00,NULL),(73,19,12,0.00,121056.00,NULL),(74,19,15,0.00,9654.40,NULL),(75,19,10,0.00,3921.31,NULL),(76,19,16,0.00,0.29,NULL),(77,19,18,112232.40,0.00,NULL),(78,19,3,0.00,112232.40,NULL),(79,20,28,82898.00,0.00,NULL),(80,20,12,0.00,58002.53,NULL),(81,20,15,0.00,22480.80,NULL),(82,20,10,0.00,2414.50,NULL),(83,20,16,0.00,0.17,NULL),(84,20,18,54076.80,0.00,NULL),(85,20,3,0.00,54076.80,NULL),(86,21,2,37304.10,0.00,NULL),(87,21,28,0.00,37304.10,NULL),(88,22,29,63433.00,0.00,NULL),(89,22,6,11188.54,0.00,NULL),(90,22,17,1500.00,0.00,NULL),(91,22,12,0.00,68777.44,NULL),(92,22,15,0.00,5127.20,NULL),(93,22,10,0.00,2217.14,NULL),(94,22,16,0.24,0.00,NULL),(95,22,18,64188.60,0.00,NULL),(96,22,3,0.00,64188.60,NULL),(97,23,2,63433.00,0.00,NULL),(98,23,29,0.00,63433.00,NULL),(99,24,30,82021.00,0.00,NULL),(100,24,12,0.00,73052.74,NULL),(101,24,15,0.00,6579.36,NULL),(102,24,10,0.00,2388.96,NULL),(103,24,16,0.06,0.00,NULL),(104,24,18,70486.80,0.00,NULL),(105,24,3,0.00,70486.80,NULL),(106,25,1,82021.00,0.00,NULL),(107,25,30,0.00,82021.00,NULL),(108,26,7,75753.00,0.00,NULL),(109,26,12,0.00,64046.92,NULL),(110,26,15,0.00,9500.00,NULL),(111,26,10,0.00,2206.41,NULL),(112,26,16,0.33,0.00,NULL),(113,26,18,60155.20,0.00,NULL),(114,26,3,0.00,60155.20,NULL),(115,27,2,75753.00,0.00,NULL),(116,27,7,0.00,75753.00,NULL),(117,28,31,173159.00,0.00,NULL),(118,28,17,1500.00,0.00,NULL),(119,28,12,0.00,158202.18,NULL),(120,28,15,0.00,11370.00,NULL),(121,28,10,0.00,5087.17,NULL),(122,28,16,0.35,0.00,NULL),(123,28,18,148037.40,0.00,NULL),(124,28,3,0.00,148037.40,NULL),(125,29,7,75963.00,0.00,NULL),(126,29,12,0.00,73400.00,NULL),(127,29,15,0.00,350.00,NULL),(128,29,10,0.00,2212.50,NULL),(129,29,16,0.00,0.50,NULL),(130,29,18,69600.00,0.00,NULL),(131,29,3,0.00,69600.00,NULL),(132,30,1,75963.00,0.00,NULL),(133,30,7,0.00,75963.00,NULL),(134,31,28,170202.00,0.00,NULL),(135,31,12,0.00,155836.80,NULL),(136,31,15,0.00,9408.00,NULL),(137,31,10,0.00,4957.34,NULL),(138,31,16,0.14,0.00,NULL),(139,32,2,170202.00,0.00,NULL),(140,32,28,0.00,170202.00,NULL),(141,33,2,50000.00,0.00,NULL),(142,33,24,0.00,50000.00,NULL),(143,34,32,85000.00,0.00,NULL),(144,34,2,0.00,85000.00,NULL),(145,35,32,85000.00,0.00,NULL),(146,35,2,0.00,85000.00,NULL),(147,36,33,14200.00,0.00,NULL),(148,36,2,0.00,14200.00,NULL),(149,37,33,3100.00,0.00,NULL),(150,37,2,0.00,3100.00,NULL),(151,38,33,6800.00,0.00,NULL),(152,38,1,0.00,6800.00,NULL),(153,39,34,24500.00,0.00,NULL),(154,39,1,0.00,24500.00,NULL),(155,40,34,11800.00,0.00,NULL),(156,40,2,0.00,11800.00,NULL),(157,41,35,32000.00,0.00,NULL),(158,41,2,0.00,32000.00,NULL),(159,42,35,9500.00,0.00,NULL),(160,42,2,0.00,9500.00,NULL),(161,43,36,4300.00,0.00,NULL),(162,43,1,0.00,4300.00,NULL),(163,44,36,2650.00,0.00,NULL),(164,44,1,0.00,2650.00,NULL),(165,45,33,1900.00,0.00,NULL),(166,45,1,0.00,1900.00,NULL),(167,46,20,325.50,0.00,NULL),(168,46,4,0.00,325.50,NULL),(183,49,7,86717.00,0.00,NULL),(184,49,12,0.00,78335.82,NULL),(185,49,15,0.00,5855.20,NULL),(186,49,10,0.00,2525.73,NULL),(187,49,16,0.00,0.25,NULL),(188,49,18,73302.60,0.00,NULL),(189,49,3,0.00,73302.60,NULL),(190,50,1,86717.00,0.00,NULL),(191,50,7,0.00,86717.00,NULL),(192,51,24,152097.00,0.00,NULL),(193,51,12,0.00,140392.26,NULL),(194,51,15,0.00,11704.40,NULL),(195,51,16,0.00,0.34,NULL),(196,51,18,131371.80,0.00,NULL),(197,51,3,0.00,131371.80,NULL),(198,52,2,152097.00,0.00,NULL),(199,52,24,0.00,152097.00,NULL),(200,53,24,210810.00,0.00,NULL),(201,53,12,0.00,208710.00,NULL),(202,53,15,0.00,2100.00,NULL),(203,54,1,210810.00,0.00,NULL),(204,54,24,0.00,210810.00,NULL),(205,55,3,146800.00,0.00,NULL),(206,55,8,4404.00,0.00,NULL),(207,55,37,0.00,151204.00,NULL),(208,56,37,151204.00,0.00,NULL),(209,56,1,0.00,151204.00,NULL),(210,57,3,220200.00,0.00,NULL),(211,57,8,6606.00,0.00,NULL),(212,57,37,0.00,226806.00,NULL),(213,58,37,226806.00,0.00,NULL),(214,58,2,0.00,226806.00,NULL),(215,59,3,734000.00,0.00,NULL),(216,59,20,0.00,734000.00,NULL),(217,60,38,220200.00,0.00,NULL),(218,60,12,0.00,220200.00,NULL),(219,60,18,220200.00,0.00,NULL),(220,60,3,0.00,220200.00,NULL),(224,62,7,222300.00,0.00,NULL),(225,62,12,0.00,220200.00,NULL),(226,62,15,0.00,2100.00,NULL),(227,63,1,222300.00,0.00,NULL),(228,63,7,0.00,222300.00,NULL),(229,64,34,10000.00,0.00,NULL),(230,64,1,0.00,10000.00,NULL);
/*!40000 ALTER TABLE `voucher_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vouchers`
--

DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `vouchers` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `voucher_no` varchar(30) NOT NULL,
  `vtype` enum('sale','purchase','receipt','payment','expense','journal','contra','adjustment','opening') NOT NULL,
  `vdate` date NOT NULL,
  `narration` varchar(255) DEFAULT NULL,
  `ref_type` varchar(30) DEFAULT NULL,
  `ref_id` int(10) unsigned DEFAULT NULL,
  `status` enum('active','cancelled') NOT NULL DEFAULT 'active',
  `created_by` int(10) unsigned DEFAULT NULL,
  `cancelled_by` int(10) unsigned DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vouchers_no` (`voucher_no`),
  KEY `idx_vouchers_date` (`vdate`,`status`),
  KEY `idx_vouchers_ref` (`ref_type`,`ref_id`),
  KEY `idx_vouchers_type` (`vtype`,`status`),
  KEY `fk_vouchers_creator` (`created_by`),
  CONSTRAINT `fk_vouchers_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vouchers`
--

LOCK TABLES `vouchers` WRITE;
/*!40000 ALTER TABLE `vouchers` DISABLE KEYS */;
INSERT INTO `vouchers` VALUES (1,'VCH-2627-00001','purchase','2026-07-18','Purchase PUR-2627-00001 — Vora Gold Refiners','purchase',1,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(2,'VCH-2627-00002','purchase','2026-07-25','Purchase PUR-2627-00002 — Shree Balaji Metals','purchase',2,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(3,'VCH-2627-00003','purchase','2026-07-30','Purchase PUR-2627-00003 — Vora Gold Refiners','purchase',3,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(4,'VCH-2627-00004','purchase','2026-07-31','Purchase PUR-2627-00004 — Shree Balaji Metals','purchase',4,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(5,'VCH-2627-00005','purchase','2026-07-27','Purchase PUR-2627-00005 — Sai Karigar Works','purchase',5,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(6,'VCH-2627-00006','payment','2026-07-31','Vendor payment PAY-2627-00001','vendor_payment',1,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(7,'VCH-2627-00007','payment','2026-07-31','Vendor payment PAY-2627-00002','vendor_payment',2,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(8,'VCH-2627-00008','payment','2026-07-31','Vendor payment PAY-2627-00003','vendor_payment',3,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(9,'VCH-2627-00009','payment','2026-07-31','Vendor payment PAY-2627-00004','vendor_payment',4,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(10,'VCH-2627-00010','sale','2026-07-20','Bill INV-2627-00001','invoice',1,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(11,'VCH-2627-00011','receipt','2026-07-20','Receipt RCPT-2627-00001','receipt',1,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(12,'VCH-2627-00012','sale','2026-07-22','Bill INV-2627-00002','invoice',2,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(13,'VCH-2627-00013','receipt','2026-07-22','Receipt RCPT-2627-00002','receipt',2,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(14,'VCH-2627-00014','sale','2026-07-24','Bill INV-2627-00003','invoice',3,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(15,'VCH-2627-00015','receipt','2026-07-24','Receipt RCPT-2627-00003','receipt',3,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(16,'VCH-2627-00016','receipt','2026-07-27','Receipt RCPT-2627-00004','receipt',4,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(17,'VCH-2627-00017','sale','2026-07-26','Bill INV-2627-00004','invoice',4,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(18,'VCH-2627-00018','receipt','2026-07-26','Receipt RCPT-2627-00005','receipt',5,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(19,'VCH-2627-00019','sale','2026-07-28','Bill INV-2627-00005','invoice',5,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(20,'VCH-2627-00020','sale','2026-07-29','Bill INV-2627-00006','invoice',6,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(21,'VCH-2627-00021','receipt','2026-07-29','Receipt RCPT-2627-00006','receipt',6,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(22,'VCH-2627-00022','sale','2026-07-31','Bill INV-2627-00007','invoice',7,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(23,'VCH-2627-00023','receipt','2026-07-31','Receipt RCPT-2627-00007','receipt',7,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(24,'VCH-2627-00024','sale','2026-08-01','Bill INV-2627-00008','invoice',8,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(25,'VCH-2627-00025','receipt','2026-08-01','Receipt RCPT-2627-00008','receipt',8,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(26,'VCH-2627-00026','sale','2026-08-01','Bill INV-2627-00009','invoice',9,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(27,'VCH-2627-00027','receipt','2026-08-01','Receipt RCPT-2627-00009','receipt',9,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:18','2026-08-01 09:51:18'),(28,'VCH-2627-00028','sale','2026-08-01','Bill INV-2627-00010','invoice',10,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(29,'VCH-2627-00029','sale','2026-08-01','Bill INV-2627-00011','invoice',11,'cancelled',1,1,'2026-08-01 15:21:19','Customer changed their mind — piece returned to stock.','2026-08-01 09:51:19','2026-08-01 09:51:19'),(30,'VCH-2627-00030','receipt','2026-08-01','Receipt RCPT-2627-00010','receipt',10,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(31,'VCH-2627-00031','sale','2026-08-01','Bill INV-2627-00012','invoice',15,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(32,'VCH-2627-00032','receipt','2026-08-01','Receipt RCPT-2627-00011','receipt',11,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(33,'VCH-2627-00033','receipt','2026-08-01','Receipt RCPT-2627-00012','receipt',12,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(34,'VCH-2627-00034','expense','2026-08-01','Showroom rent — Zaveri Bazaar','expense',1,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(35,'VCH-2627-00035','expense','2026-07-01','Showroom rent — previous month','expense',2,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(36,'VCH-2627-00036','expense','2026-07-28','Electricity bill','expense',3,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(37,'VCH-2627-00037','expense','2026-07-23','Internet & telephone','expense',4,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(38,'VCH-2627-00038','expense','2026-07-14','Water & maintenance','expense',5,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(39,'VCH-2627-00039','expense','2026-07-26','Setting charges — 9 pieces','expense',6,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(40,'VCH-2627-00040','expense','2026-07-19','Rhodium & polish work','expense',7,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(41,'VCH-2627-00041','expense','2026-07-24','Festival campaign — Instagram & Meta ads','expense',8,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(42,'VCH-2627-00042','expense','2026-07-11','Newspaper insert — local edition','expense',9,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(43,'VCH-2627-00043','expense','2026-07-29','Boxes, pouches & billing stationery','expense',10,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(44,'VCH-2627-00044','expense','2026-07-16','Hallmarking pouches','expense',11,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(45,'VCH-2627-00045','expense','2026-07-31','Diesel — generator','expense',12,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(46,'VCH-2627-00046','adjustment','2026-08-01','Stock adjustment — physical count shortage','stock_adjustment',305,'active',1,NULL,NULL,NULL,'2026-08-01 09:51:19','2026-08-01 09:51:19'),(49,'VCH-2627-00047','sale','2026-08-02','Bill INV-2627-00013','invoice',16,'active',2,NULL,NULL,NULL,'2026-08-01 10:02:42','2026-08-01 10:02:42'),(50,'VCH-2627-00048','receipt','2026-08-02','Receipt RCPT-2627-00013','receipt',13,'active',2,NULL,NULL,NULL,'2026-08-01 10:02:42','2026-08-01 10:02:42'),(51,'VCH-2627-00049','sale','2026-08-01','Bill INV-2627-00014','invoice',17,'active',2,NULL,NULL,NULL,'2026-08-01 10:07:46','2026-08-01 10:07:46'),(52,'VCH-2627-00050','receipt','2026-08-01','Receipt RCPT-2627-00014','receipt',14,'active',2,NULL,NULL,NULL,'2026-08-01 10:07:46','2026-08-01 10:07:46'),(53,'VCH-2627-00051','sale','2026-08-01','Bill INV-2627-00015','invoice',18,'active',1,NULL,NULL,NULL,'2026-08-01 10:17:07','2026-08-01 10:17:07'),(54,'VCH-2627-00052','receipt','2026-08-01','Receipt RCPT-2627-00015','receipt',15,'active',1,NULL,NULL,NULL,'2026-08-01 10:17:07','2026-08-01 10:17:07'),(55,'VCH-2627-00053','purchase','2026-08-01','Purchase PUR-2627-00006 — Patel Angadia Services','purchase',6,'active',2,NULL,NULL,NULL,'2026-08-01 10:55:29','2026-08-01 10:55:29'),(56,'VCH-2627-00054','payment','2026-08-01','Vendor payment PAY-2627-00005','vendor_payment',5,'active',2,NULL,NULL,NULL,'2026-08-01 10:55:29','2026-08-01 10:55:29'),(57,'VCH-2627-00055','purchase','2026-08-01','Purchase PUR-2627-00007 — Patel Angadia Services','purchase',7,'active',2,NULL,NULL,NULL,'2026-08-01 10:56:40','2026-08-01 10:56:40'),(58,'VCH-2627-00056','payment','2026-08-01','Vendor payment PAY-2627-00006','vendor_payment',6,'active',2,NULL,NULL,NULL,'2026-08-01 10:56:40','2026-08-01 10:56:40'),(59,'VCH-2627-00057','adjustment','2026-08-01','Stock adjustment — Found during stock count','stock_adjustment',331,'active',7,NULL,NULL,NULL,'2026-08-01 10:57:55','2026-08-01 10:57:55'),(60,'VCH-2627-00058','sale','2026-08-01','Bill INV-2627-00016','invoice',19,'active',2,NULL,NULL,NULL,'2026-08-01 10:59:07','2026-08-01 10:59:07'),(62,'VCH-2627-00059','sale','2026-08-01','Bill INV-2627-00017','invoice',20,'active',7,NULL,NULL,NULL,'2026-08-01 11:10:55','2026-08-01 11:10:55'),(63,'VCH-2627-00060','receipt','2026-08-01','Receipt RCPT-2627-00016','receipt',16,'active',7,NULL,NULL,NULL,'2026-08-01 11:10:55','2026-08-01 11:10:55'),(64,'VCH-2627-00061','expense','2026-08-01','Expense','expense',13,'active',7,NULL,NULL,NULL,'2026-08-01 11:21:28','2026-08-01 11:21:28');
/*!40000 ALTER TABLE `vouchers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'jewellers_crm'
--

--
-- Dumping routines for database 'jewellers_crm'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-01 16:57:33
