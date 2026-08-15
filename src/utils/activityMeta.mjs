/**
 * 检测状态元数据统一表（唯一来源）
 * 曾被 ActivityBadge / AlertBanner / useNotifier 三处各自维护并发生文案漂移
 * label: 状态徽标短名；text: 告警横幅/通知文案；halo: 呼吸光环样式
 */
export const ACTIVITY_META = {
  calm: { label: '安静', text: '宝宝安静', halo: '', cls: 'calm' },
  moving: { label: '轻微活动', text: '🟡 宝宝有活动', halo: 'warn', cls: 'moving' },
  crying: { label: '哭闹', text: '🔴 宝宝在哭', halo: 'alert', cls: 'crying' },
}

export const ACTIVITY_STATES = Object.keys(ACTIVITY_META)
