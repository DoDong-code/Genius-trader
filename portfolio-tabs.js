(function(){
  const root=document.querySelector('#view-root'),state=window.portfolioState;
  function enhance(){
    const section=root.querySelector('.list-section'),isPortfolio=!!root.querySelector('.fund-list');document.body.classList.toggle('portfolio-mode',isPortfolio);if(!isPortfolio||!section)return;
    let tabs=root.querySelector('.portfolio-account-tabs');if(!tabs){tabs=document.createElement('div');tabs.className='account-segmented portfolio-account-tabs';tabs.setAttribute('role','tablist');tabs.innerHTML=Object.keys(state.accounts).map(n=>'<button class="account-segment" data-portfolio-account="'+n.replace(/"/g,'&quot;')+'">'+n.replace(/（朋友账户）/,'')+'</button>').join('');section.before(tabs)}
    const active=state.getActive();tabs.querySelectorAll('.account-segment').forEach(b=>b.classList.toggle('active',b.dataset.portfolioAccount===active))
  }
  root.addEventListener('click',e=>{const tab=e.target.closest('[data-portfolio-account]');if(!tab)return;e.preventDefault();e.stopImmediatePropagation();const name=tab.dataset.portfolioAccount;if(state.accounts[name]){state.setActive(name);document.querySelector('.nav-tab[data-view="portfolio"]')?.click()}},true);
  new MutationObserver(enhance).observe(root,{childList:true,subtree:true});enhance();
})();
