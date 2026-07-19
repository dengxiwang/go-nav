// open-next.config.ts - OpenNext Cloudflare 配置
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // 如需启用 R2 增量缓存，请参考：
  // https://opennext.js.org/cloudflare/caching
});
