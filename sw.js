// ==========================================================
// 🍑 屁桃星离线小屋 Service Worker · v7.9.0
// 策略：network-first —— 联网时永远拿最新版（成功后可靠更新缓存），
//       断网或服务器出错(5xx等)时从缓存开小屋；回忆本来就住在IndexedDB里，一条不少。
// API请求（openrouter.ai / tavily 等跨域）完全不拦截，直接走网络。
// ⚠️ 每次发新版请同步更新下面的 CACHE 版本号（与 index.html 的 APP_VERSION 对应）
// v7.9.0: 记忆库9大定制分类＋3层精准唤醒（停用词过滤/上限6+2/休眠唤醒）；修复空输入框变窄bug；新增一键清理原图保留缩略图＋发图自动压缩瘦身开关；阅读进度支持自定义与模糊日期（以前读完/之前就看一半）。
// v7.8.9: 起点与终点支持同名多地点候选确认（如多个万达广场按距离由近到远列出完整地址，点选确认后再算路，绝不擅自猜错）。
// v7.8.8: 百度多策略公交改为串行错峰请求（每条间隔450ms，并发≤1），彻底避免触发百度3/秒并发上限告警。
// v7.8.7: 百度公交/地铁并行拉取全部策略（时间短/少换乘/少步行/纯公交）并去重，取消5套上限，完整展示全部备选方案。
// v7.8.6: 百度公交/地铁支持多备选方案自由切换＋「想坐的线路/车次」自动优先匹配（如填 96路 813路 自动锁定对应方案）。
// v7.8.5: 新增「大致路线总览」链条（步行→地铁/公交→步行一眼看清）、自动合并过碎短步行步(<25米)、修复偏航提示条CSS覆盖hidden导致的常显bug（版本号跳过4）。
// v7.8.3: 导航打磨三连——外部地图新增百度地图跳转、公交模式步行段自动展开详细转向＋东南西北方向、偏航改为点到路线折线真实垂直距离消除起点误报。
// v7.8.2: 新增百度地图浏览器端 AK 引擎（国内步行/公交地铁/周边中文地标 + WGS84↔BD-09 自动纠偏），与 GraphHopper/高德组成三引擎自动切换。
// v7.8.1: 新增一键彻底清空全部位置与导航痕迹（停止定位+删ps3_nav+清坐标/起终点/地图预览）。
// v7.8.0: 正式升级双引擎地图指路系统（GraphHopper海外/全球 + 高德JS API国内步行与公交），独立持久导航状态(ps3_nav)、本地GPS陪走与偏航提醒、路口地标与按需AI路况注入。
// v7.7.17: 升级两档搜索——普通搜索升级为单轮多语言多角度智能规划（≤6次），高级搜索升级为两轮边搜边查自适应追搜（4+6次，支持模糊寻片原名追搜与旅行日报模式）。
// v7.7.16: 新增独立多书阅读进度模块（ps3_reading）、近7天刚读完缓冲、荐书已读排重；取消记忆提议15秒自动消失。
// v7.7.15: 地图入口移入菜单，释放输入框上方空间。
// v7.7.8: 普通双检索、高级10次、多来源去重分配、日期与引用核查。
// v7.6.5: 即v7.6.4封版内容，版本号跳过'4'直接用5 —— 收尾4点——导入前先落盘草稿+清孤儿草稿、编辑摘要为空同步归零范围、
//          摘要pending按归属清理（不误伤别屋新提醒）、safeRating统一钳制+日历emoji/日期转义
// v7.6.3: GPT复检5组——删除/导入后编辑区统一重置、摘要不可变收件地址（快照制）、
//          图片能力改读input_modalities+不依赖allM、PDF全模型解锁、单聊导出默认不带prompt预览、
//          导入数据XSS加固（模型名/档案字段/纪念日/评分状态枚举校验）
// v7.6.2: 封版修虫9连——多选绑定convId+生成闸门、附件不串对话、私人导出隔离、
//          流式中断如实标注、摘要范围校验+提示条绑定对话、记忆写盘校验回滚、
//          备份补全mood/sCfg/文件夹状态、导入加生成闸门、moodday清理（纯前端，仅版本号同步）
// v7.6.1: 修复S模式串对话/重复开启计时器/坏桃核处理不完整，任务白名单硬化（纯前端，仅版本号同步）
// v7.4.2: 回退只查当前CACHE（不误取同域其他应用缓存内容）
// v7.4.1 修复（GPT验收三连）：
//   1. activate只清理屁桃星自己的旧缓存（peachstation-前缀），不误伤同域其他小应用
//   2. 服务器返回非2xx（如503/500）时也优先用缓存开门，没缓存才原样返回错误
//   3. 缓存更新纳入event.waitUntil()保护，SW不会在写入完成前被终止
// ==========================================================
const CACHE='peachstation-v7.8.9'; // v7.6.4跳过不用，屁桃星没有'4'🍑
const SHELL=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(SHELL))
      .then(()=>self.skipWaiting()) // 新版立即接管，不等旧页面全关
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      // v7.4.1: 只删屁桃星自己的旧版本缓存，同域其他应用的缓存不碰
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('peachstation-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  let url;try{url=new URL(req.url)}catch(x){return}
  // 只接管同源GET（小屋自己的文件）；API等跨域请求不碰
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  e.respondWith(
    fetch(req).then(res=>{
      if(res&&res.ok){
        // v7.4.1: 缓存更新放进waitUntil保护，确保写入完成后SW才允许休眠
        const copy=res.clone();
        e.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));
        return res;
      }
      // v7.4.1: 服务器返回错误(5xx/4xx)时优先用缓存开小屋；没缓存才把错误原样交回
      // v7.4.2: 回退限定当前CACHE，绝不从同域其他应用的缓存里取内容
      return caches.open(CACHE).then(c=>c.match(req)).then(hit=>hit||res);
    }).catch(()=>
      caches.open(CACHE).then(c=>
        c.match(req).then(hit=>{
          if(hit)return hit;
          // 断网时的页面导航兜底：开小屋主页
          if(req.mode==='navigate')return c.match('./index.html');
          return new Response('',{status:504,statusText:'offline'});
        })
      )
    )
  );
});
