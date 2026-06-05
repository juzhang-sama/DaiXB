/** 解析征信报告中的日期字符串，兼容 2026.01.02 / 2026-01-02 / 2026/01/02 */
export function parseDateLoose(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

/** 以报告时间作为计算口径，缺失时才回退当前时间 */
export function getReferenceDate(reportTime: string | null | undefined): Date {
  return parseDateLoose(reportTime) ?? new Date();
}

export function monthsBefore(referenceDate: Date, months: number): Date {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() - months, referenceDate.getDate());
}

export function calcAgeAt(birthDate: string | null | undefined, referenceDate: Date): number | null {
  const birth = parseDateLoose(birthDate);
  if (!birth) return null;
  let age = referenceDate.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    referenceDate.getMonth() < birth.getMonth() ||
    (referenceDate.getMonth() === birth.getMonth() && referenceDate.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age >= 0 && age <= 120 ? age : null;
}
