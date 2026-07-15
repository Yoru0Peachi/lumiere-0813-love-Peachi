// ==========================================================
// 🍑 屁桃星离线小屋 Service Worker · v7.6.5
// 策略：network-first —— 联网时永远拿最新版（成功后可靠更新缓存），
//       断网或服务器出错(5xx等)时从缓存开小屋；回忆本来就住在IndexedDB里，一条不少。
// API请求（openrouter.ai / tavily 等跨域）完全不拦截，直接走网络。
// ⚠️ 每次发新版请同步更新下面的 CACHE 版本号（与 index.html 的 APP_VERSION 对应）
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
const CACHE='peachstation-v7.6.5'; // v7.6.4跳过不用，屁桃星没有'4'🍑
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
