import { ClientProfile, ConfidenceMap } from '../types/client-profile';
import { ExtractedField } from './types';

/** 交叉校验规则：用字段间逻辑关系修正置信度 */
export function crossValidate(
  profile: ClientProfile,
  confidence: ConfidenceMap,
): ConfidenceMap {
  const result = { ...confidence };

  // 已用额度 > 总授信 → 两者都降低置信度
  if (
    profile.usedCreditLimit !== null &&
    profile.totalCreditLimit !== null &&
    profile.usedCreditLimit > profile.totalCreditLimit
  ) {
    result.usedCreditLimit = penalize(result.usedCreditLimit);
    result.totalCreditLimit = penalize(result.totalCreditLimit);
  }

  // 查询次数递增关系：q1m <= q2m <= q6m
  if (profile.q1m !== null && profile.q2m !== null && profile.q1m > profile.q2m) {
    result.q1m = penalize(result.q1m);
    result.q2m = penalize(result.q2m);
  }
  if (profile.q2m !== null && profile.q6m !== null && profile.q2m > profile.q6m) {
    result.q2m = penalize(result.q2m);
    result.q6m = penalize(result.q6m);
  }

  // 身份证号与年龄交叉验证
  if (profile.idCard && profile.age !== null) {
    const birthYear = parseInt(profile.idCard.substring(6, 10), 10);
    const expectedAge = new Date().getFullYear() - birthYear;
    if (Math.abs(expectedAge - profile.age) > 1) {
      result.age = penalize(result.age);
    }
  }

  return result;
}

/** 将置信度降低 0.2，最低到 0.3 */
function penalize(current: number | null | undefined): number {
  if (typeof current !== 'number') return 0.3;
  return Math.max(current - 0.2, 0.3);
}

