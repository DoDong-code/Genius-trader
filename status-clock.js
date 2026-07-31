(function(){
  const status=document.querySelector('.sync-status');
  if(!status)return;
  const storageKey='genius-trader-data-updated-at';
  let updatedAt=Number(sessionStorage.getItem(storageKey));
  if(!Number.isFinite(updatedAt)||updatedAt>Date.now()||Date.now()-updatedAt>30*60*1000){
    updatedAt=Date.now();
    sessionStorage.setItem(storageKey,String(updatedAt));
  }
  status.innerHTML='<span class="status-copy"><strong class="status-time"></strong><span class="status-update-row"><i aria-hidden="true"></i><small class="status-update"></small></span></span>';
  const time=status.querySelector('.status-time');
  const update=status.querySelector('.status-update');
  const formatter=new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});
  function render(){
    time.textContent=formatter.format(new Date());
    const minutes=Math.max(0,Math.floor((Date.now()-updatedAt)/60000));
    update.textContent='数据更新 · '+(minutes<1?'刚刚':minutes+' 分钟前');
  }
  render();
  setInterval(render,1000);
})();
