// ============================================================
// SILOG Driver Control Tower - Scoring Logic
// ============================================================

import { type Driver, type RewardRule, EXTERNAL_RCA_CATEGORIES, type RCACategory } from './types';

/**
 * Calculate final score: Total Reward Points - Total Punishment Points
 */
export function calculateFinalScore(rewardPoints: number, punishmentPoints: number): number {
  return rewardPoints - punishmentPoints;
}

/**
 * Check if an RCA category is external (not driver's fault)
 */
export function isExternalCause(category: RCACategory): boolean {
  return EXTERNAL_RCA_CATEGORIES.includes(category);
}

/**
 * Calculate On Time percentage
 */
export function calculateOnTimePercentage(onTime: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((onTime / total) * 1000) / 10;
}

/**
 * Calculate OTIF percentage
 * OTIF = (Jumlah Pengiriman yang On Time DAN In Full / Total Pengiriman) × 100%
 */
export function calculateOTIF(otifCount: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((otifCount / total) * 1000) / 10;
}

/**
 * Sort drivers by final score for leaderboard.
 * Uses score per delivery to fairly compare drivers with different volumes.
 */
export function sortDriversByScore(drivers: Driver[]): Driver[] {
  return [...drivers].sort((a, b) => {
    // Primary: final score descending
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    // Secondary: on time percentage descending
    if (b.onTimePercentage !== a.onTimePercentage) return b.onTimePercentage - a.onTimePercentage;
    // Tertiary: fewer violations
    return a.validViolations - b.validViolations;
  });
}

/**
 * Get reward points for an on-time delivery
 */
export function getOnTimeRewardPoints(rules: RewardRule[]): number {
  const rule = rules.find(r => r.type === 'reward' && r.name === 'Pengiriman Tepat Waktu' && r.isActive);
  return rule?.points ?? 10;
}

/**
 * Get punishment points for a specific violation category
 */
export function getPunishmentPoints(rules: RewardRule[], category: RCACategory): number {
  const rule = rules.find(r => r.type === 'punishment' && r.category === category && r.isActive);
  return rule?.points ?? 5;
}

/**
 * Format score with sign
 */
export function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  return `${score}`;
}

/**
 * Calculate score per delivery for fair comparison
 */
export function scorePerDelivery(driver: Driver): number {
  if (driver.totalDeliveries === 0) return 0;
  return Math.round((driver.finalScore / driver.totalDeliveries) * 100) / 100;
}

