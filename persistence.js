(function(){
  const state=window.portfolioState;
  if(!state)return;
  const storageKey='genius-trader-portfolio-v1';
  const originalSetActive=state.setActive.bind(state);

  function save(){
    try{
      localStorage.setItem(storageKey,JSON.stringify({
        accounts:state.accounts,
        active:state.getActive()
      }));
    }catch(error){
      console.warn('Portfolio data could not be saved.',error);
    }
  }

  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved&&saved.accounts&&typeof saved.accounts==='object'){
      const valid=Object.entries(saved.accounts).filter(([,account])=>
        account&&typeof account.name==='string'&&Array.isArray(account.funds)
      );
      if(valid.length){
        Object.keys(state.accounts).forEach(name=>delete state.accounts[name]);
        valid.forEach(([name,account])=>{state.accounts[name]=account});
        const active=state.accounts[saved.active]?saved.active:Object.keys(state.accounts)[0];
        if(active)originalSetActive(active);
      }
    }
  }catch(error){
    console.warn('Saved portfolio data could not be restored.',error);
  }

  if(typeof window.applyAccount2PortfolioCorrection==='function'&&window.applyAccount2PortfolioCorrection(state.accounts)){
    save();
  }

  state.setActive=function(name){
    originalSetActive(name);
    save();
  };
  state.persist=save;
  window.savePortfolioState=save;
})();
