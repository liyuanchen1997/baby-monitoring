/**
 * 局域网 IP 检测工具
 * 被 cert.mjs（证书 SAN）、dev.mjs（访问清单）、server/index.mjs（/api/info）复用
 */
import os from 'node:os'

/** 过滤出所有非内部 IPv4，优先内网段（192.168/10./172.16-31） */
export function listLanIPv4s() {
  const addrs = []
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue
      addrs.push(iface.address)
    }
  }
  const inPrivateScope = (ip) =>
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  return [...addrs.filter(inPrivateScope), ...addrs.filter((a) => !inPrivateScope(a))]
}
