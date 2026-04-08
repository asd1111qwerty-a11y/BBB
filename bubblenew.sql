-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 07, 2026 at 12:28 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bubble_am`
--

-- --------------------------------------------------------

--
-- Table structure for table `guilds`
--

CREATE TABLE `guilds` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `tag` varchar(8) NOT NULL,
  `leader_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `type` enum('open','invite','public','private') DEFAULT 'open',
  `skin` varchar(100) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `guilds`
--

INSERT INTO `guilds` (`id`, `name`, `tag`, `leader_id`, `created_at`, `type`, `skin`, `description`) VALUES
(12, 'ETMIN GANK !', 'ETM', 1, '2026-04-05 09:00:42', 'private', 'guilds/guild_12', 'SEMOGA SUKSES GANK !\n\nFB : https://www.facebook.com/\n\nJANGAN DI ANIMEK ANIMEK IN APA');

-- --------------------------------------------------------

--
-- Table structure for table `guild_invites`
--

CREATE TABLE `guild_invites` (
  `id` int(11) NOT NULL,
  `guild_id` int(11) NOT NULL,
  `from_user` varchar(100) DEFAULT NULL,
  `to_user_id` int(11) NOT NULL,
  `status` enum('pending','accepted','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `guild_logs`
--

CREATE TABLE `guild_logs` (
  `id` int(11) NOT NULL,
  `guild_id` int(11) NOT NULL,
  `action` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `guild_logs`
--

INSERT INTO `guild_logs` (`id`, `guild_id`, `action`, `description`, `created_at`) VALUES
(11, 12, NULL, 'meki was promoted to Staff', '2026-04-05 15:58:03'),
(12, 12, NULL, 'dilma was promoted to Staff', '2026-04-05 15:58:09'),
(13, 12, NULL, 'dilma was demoted to Member', '2026-04-05 15:58:12'),
(14, 12, NULL, 'meki was demoted to Member', '2026-04-05 15:58:14'),
(15, 12, NULL, 'dilma was promoted to Staff', '2026-04-05 15:58:15'),
(16, 12, NULL, 'dilma left the guild', '2026-04-05 15:59:58'),
(17, 12, NULL, 'dilma was promoted to Staff', '2026-04-05 16:00:21'),
(18, 12, NULL, 'TUTOR NO NAME GA DEK joined the guild via invite', '2026-04-05 16:44:41'),
(19, 12, NULL, 'meki was promoted to Staff', '2026-04-05 16:50:00'),
(20, 12, NULL, 'TUTOR NO NAME GA DEK was promoted to Staff', '2026-04-05 16:50:01'),
(21, 12, NULL, 'Blatter was kicked from the guild', '2026-04-06 17:52:56'),
(22, 12, NULL, 'Honey invited DEV', '2026-04-07 07:32:35'),
(23, 12, NULL, 'DEV joined the guild via invite', '2026-04-07 07:48:07'),
(24, 12, NULL, 'DEV left the guild', '2026-04-07 07:48:11'),
(25, 12, NULL, 'Honey invited DEV', '2026-04-07 07:52:08'),
(26, 12, NULL, 'DEV joined the guild via invite', '2026-04-07 07:52:14'),
(27, 12, NULL, 'DEV left the guild', '2026-04-07 07:52:28'),
(28, 12, NULL, 'Honey invited DEV', '2026-04-07 07:53:01'),
(29, 12, NULL, 'DEV joined the guild via invite', '2026-04-07 07:53:08'),
(30, 12, NULL, 'DEV left the guild', '2026-04-07 07:53:13'),
(31, 12, NULL, 'DEV joined the guild', '2026-04-07 08:20:49'),
(32, 12, NULL, 'DEV left the guild', '2026-04-07 08:20:53'),
(33, 12, NULL, 'Honey invited DEV', '2026-04-07 09:18:37'),
(34, 12, NULL, 'DEV joined the guild', '2026-04-07 09:18:45'),
(35, 12, NULL, 'DEV was promoted to Staff', '2026-04-07 09:58:12');

-- --------------------------------------------------------

--
-- Table structure for table `top_times`
--

CREATE TABLE `top_times` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `server` varchar(50) NOT NULL,
  `minutes` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `top_times`
--

INSERT INTO `top_times` (`id`, `user_id`, `username`, `server`, `minutes`, `created_at`, `updated_at`) VALUES
(75, 1, 'Honey', 'localhost:8080', 7, '2026-04-07 07:17:50', '2026-04-07 10:05:15');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `xp` float DEFAULT 0,
  `level` int(11) DEFAULT 1,
  `last_login` timestamp NOT NULL DEFAULT current_timestamp(),
  `role` set('user','admin','banned','noname','mod') NOT NULL DEFAULT 'user',
  `color` varchar(7) DEFAULT NULL,
  `account_type` enum('free','premium') NOT NULL DEFAULT 'free',
  `points` decimal(10,2) DEFAULT 0.00,
  `skin` varchar(100) DEFAULT NULL,
  `active_skin` varchar(20) DEFAULT 'personal',
  `guild_id` int(11) DEFAULT NULL,
  `guild_role` enum('member','staff','leader') DEFAULT 'member',
  `top_score` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `created_at`, `xp`, `level`, `last_login`, `role`, `color`, `account_type`, `points`, `skin`, `active_skin`, `guild_id`, `guild_role`, `top_score`) VALUES
(1, 'Honey', 'jembutkuda12@gmail.com', '$2b$10$f8o5Bqx5KRczrNj0CIfCFuOkYy1909eIHXSnS1yOOH0xQQE9u6EkW', '2026-03-11 03:34:27', 211.71, 34, '2026-04-07 10:19:40', 'admin,noname', '#000000', 'premium', 99998182.99, 'Honey', 'personal', 12, 'leader', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `guilds`
--
ALTER TABLE `guilds`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `guild_invites`
--
ALTER TABLE `guild_invites`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `guild_logs`
--
ALTER TABLE `guild_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `top_times`
--
ALTER TABLE `top_times`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_server` (`user_id`,`server`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `guilds`
--
ALTER TABLE `guilds`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `guild_invites`
--
ALTER TABLE `guild_invites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `guild_logs`
--
ALTER TABLE `guild_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `top_times`
--
ALTER TABLE `top_times`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
