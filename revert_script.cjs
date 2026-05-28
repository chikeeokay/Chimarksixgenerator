const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const sIdx = code.indexOf('const getBankerBookmarkletCode = (');
const eIdx = code.indexOf('const getBookmarkletCode = (');

if (sIdx !== -1 && eIdx !== -1) {
  const newSegment = `  const getBankerBookmarkletCode = (isDesktop: boolean = false) => {
    const bankerBets = generatedBets.filter(
      (b) => b.isBankerLegs && (b.bankersCount || 0) > 0,
    );
    const convertedBets = bankerBets.map((b) => ({
      bankers: b.numbers.slice(0, b.bankersCount!),
      legs: b.numbers.slice(b.bankersCount!),
    }));
    const betsJson = JSON.stringify(convertedBets);

    if (isDesktop) {
      const script = \`(async function(){
        const bets = \${betsJson};
        if (!bets || bets.length === 0) { alert("沒有生成拖膽號碼！"); return; }
        const showMsg = (msg) => {
          const d = document.createElement("div");
          d.textContent = msg;
          d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 24px;border-radius:30px;z-index:9999999;font-size:15px;pointer-events:none;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.3);transition:opacity 0.3s;";
          document.body.appendChild(d);
          setTimeout(() => { d.style.opacity = '0'; setTimeout(()=>d.remove(),300); }, 2000);
        };
        showMsg("開始自動拖膽點擊...");
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        
        const isCartWindow = (win) => {
          try {
            var name = (win.name || "").toLowerCase();
            var href = "";
            try { href = (win.location.href || "").toLowerCase(); } catch(e) {}
            if (
              name.includes("cart") || name.includes("slip") || name.includes("basket") || name.includes("reflist") || name.includes("receipt") || name.includes("queue") ||
              href.includes("cart") || href.includes("slip") || href.includes("basket") || href.includes("reflist") || href.includes("receipt") || href.includes("queue") || href.includes("login") || href.includes("left")
            ) { return true; }
          } catch(e){}
          return false;
        };
        
        const getFrames = (win) => {
          let res = [];
          if (isCartWindow(win)) return res;
          try { if(win.document) res.push({w: win, d: win.document}); } catch(e){}
          try {
            for(let i=0; i<win.frames.length; i++){
              res = res.concat(getFrames(win.frames[i]));
            }
          } catch(e){}
          return res;
        };
        
        const triggerClick = (el, win) => {
          if(!win) win = window;
          try { el.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch(e) {}
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          
          try {
            if (win.TouchEvent) {
              const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
              win.document.dispatchEvent(new TouchEvent('touchstart', opts));
              win.document.dispatchEvent(new TouchEvent('touchend', opts));
              el.dispatchEvent(new TouchEvent('touchstart', opts));
              el.dispatchEvent(new TouchEvent('touchend', opts));
            }
          } catch(e){}

          if(win.MouseEvent){
            el.dispatchEvent(new win.MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new win.MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          if(win.PointerEvent){
            el.dispatchEvent(new win.PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new win.PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          el.click();
        };

        const isInCart = (element, win) => {
          if (win && isCartWindow(win)) return true;
          var curr = element;
          while (curr) {
            var cl = "";
            var id = "";
            if (curr.className && typeof curr.className === "string") {
              cl = curr.className.toLowerCase();
            }
            if (curr.id && typeof curr.id === "string") {
              id = curr.id.toLowerCase();
            }
            if (
              cl.includes("cart") || cl.includes("slip") || cl.includes("basket") || cl.includes("summary") || cl.includes("infolist") || cl.includes("selected-numbers") || cl.includes("reflist") || cl.includes("receipt") || cl.includes("queue") ||
              id.includes("cart") || id.includes("slip") || id.includes("basket") || id.includes("summary") || id.includes("infolist") || id.includes("selected-numbers") || id.includes("reflist") || id.includes("receipt") || id.includes("queue")
            ) { return true; }
            curr = curr.parentElement;
          }
          return false;
        };
        
        let count = 0;
        for(const bet of bets){
          showMsg("正在處理第 " + (count+1) + " 注...");
          const playTypeXps = [
            "//*[normalize-space(.//text())='膽拖' and (self::a or self::button or self::input or @role='button' or contains(@class, 'tab'))]",
            "//*[normalize-space(text())='膽拖' or @value='膽拖' or @alt='膽拖']",
            "//*[normalize-space(text())='Banker-Legs' or @value='Banker-Legs']"
          ];
          let frames = getFrames(window);
          for(let {w, d} of frames) {
            try {
              for(let xp of playTypeXps) {
                const els = d.evaluate(xp, d, null, 7, null);
                for(let j=0; j<els.snapshotLength; j++){
                  const el = els.snapshotItem(j);
                  const rect = el.getBoundingClientRect();
                  if (!isInCart(el, w) && el.tagName !== 'BODY' && el.tagName !== 'HTML' && rect.height > 0) {
                    triggerClick(el, w);
                  }
                }
              }
            } catch(e){}
          }
          await sleep(1000);

          for (const section of ['bankers', 'legs']) {
            const arr = bet[section];
            if (!arr || arr.length === 0) continue;
            
            for(const num of arr){
              const str = num.toString();
              const pad = num < 10 ? '0'+num : str;
              const xpsBall = [
                "//*[(normalize-space(text())='"+str+"' or normalize-space(text())='"+pad+"') and not(*)]",
                "//*[(normalize-space(.)='"+str+"' or normalize-space(.)='"+pad+"')]"
              ];
              let clicked = false;
              let targetEl = null;
              let targetWin = null;
              
              let framesBalls = getFrames(window);
              for(let {w, d} of framesBalls) {
                try {
                  let validEls = [];
                  for(let xp of xpsBall) {
                     const els = d.evaluate(xp, d, null, 7, null);
                     for(let i=0; i<els.snapshotLength; i++){
                        const el = els.snapshotItem(i);
                        const rect = el.getBoundingClientRect();
                        if(rect.width > 0 && rect.height > 0){
                          if (isInCart(el, w)) continue;
                          
                          let hasChildrenText = false;
                          for(let c of el.children) {
                            if(c.textContent.trim().length > 0 && c.textContent.trim() !== str && c.textContent.trim() !== pad) {
                              hasChildrenText = true;
                            }
                          }
                          if (hasChildrenText) continue;
                          
                          if (rect.width >= 20 && rect.width <= 150 && rect.height >= 20 && rect.height <= 150) {
                              const elClass = (el.className || '').toString().toLowerCase();
                              if (elClass.includes('ball') || elClass.includes('num') || el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'BUTTON') {
                                validEls.push(el);
                              }
                          }
                        }
                     }
                  }
                  if(validEls.length > 0){ 
                    targetEl = section === 'bankers' ? validEls[0] : validEls[validEls.length - 1];
                    targetWin = w;
                    break;
                  }
                } catch(e){}
              }
              
              if(targetEl){ 
                triggerClick(targetEl, targetWin); 
                clicked = true;
              }

              if (!clicked) {
                showMsg("找不到號碼: " + str);
              }
              await sleep(600);
            }
          }
          showMsg("添加注項...");
          await sleep(1500);
          
          let clickedAdd = false;
          let framesAdd = getFrames(window);
          for(let {w, d} of framesAdd) {
            try {
              const exactXp = "//*[normalize-space(.)='添加到投注區' or normalize-space(.)='加入注項' or normalize-space(.)='確定' or normalize-space(.)='加入' or @alt='添加到投注區' or @alt='加入注項'] | //*[contains(translate(text(), ' ', ''), '添加到投注區') or contains(translate(text(), ' ', ''), '加入注項')]";
              const exactEls = d.evaluate(exactXp, d, null, 7, null);
              for(let i=exactEls.snapshotLength - 1; i>=0; i--){
                const el = exactEls.snapshotItem(i);
                const rect = el.getBoundingClientRect();
                if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                  triggerClick(el, w); 
                  clickedAdd = true; 
                  break; 
                }
              }
              if(clickedAdd) break;
            } catch(e){}
          }
          
          if(!clickedAdd) {
            for(let {w, d} of framesAdd) {
              try {
                const fallbackXp = "//*[contains(text(), '添加到投注區') or contains(text(), '加入注項') or contains(text(), '確定') or contains(text(), '加入')]";
                const fallbackEls = d.evaluate(fallbackXp, d, null, 7, null);
                for(let i=fallbackEls.snapshotLength - 1; i>=0; i--){
                  const el = fallbackEls.snapshotItem(i);
                  const rect = el.getBoundingClientRect();
                  if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                    triggerClick(el, w); clickedAdd = true; break; 
                  }
                }
                if(clickedAdd) break;
              } catch(e){}
            }
          }
          
          if(clickedAdd) count++;
          await sleep(4000);
        }
        showMsg("拖膽電腦版點擊完成！共輸入 " + count + " 注。");
        setTimeout(() => alert("拖膽電腦版點擊完成！共嘗試輸入 " + count + " 注。請核對投注區內容。"), 1000);
      })();\`;
      return \`javascript:\${encodeURIComponent(script)}\`;
    } else {
      const script = \`(async function(){
        const bets = \${betsJson};
        if (!bets || bets.length === 0) {
          alert("沒有生成號碼！");
          return;
        }
        const showMsg = (msg) => {
          const d = document.createElement("div");
          d.textContent = msg;
          d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 24px;border-radius:30px;z-index:9999999;font-size:15px;pointer-events:none;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,0.3);transition:opacity 0.3s;";
          document.body.appendChild(d);
          setTimeout(() => { d.style.opacity = '0'; setTimeout(()=>d.remove(),300); }, 2000);
        };
        showMsg("開始自動拖膽點擊(Mobile)...");
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const triggerClick = (el) => {
          try { el.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch(e) {}
          const rect = el.getBoundingClientRect();
          const cx = Math.round(rect.left + rect.width / 2);
          const cy = Math.round(rect.top + rect.height / 2);
          
          try {
            if (window.TouchEvent) {
              const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy };
              el.dispatchEvent(new TouchEvent('touchstart', opts));
              el.dispatchEvent(new TouchEvent('touchend', opts));
            }
          } catch(e){}

          if(window.MouseEvent){
            el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          if(window.PointerEvent){
            el.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, clientX: cx, clientY: cy}));
            el.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: cx, clientY: cy}));
          }
          el.click();
        };
        const isInCart = (element) => {
          var curr = element;
          while (curr) {
            var cl = "";
            var id = "";
            if (curr.className && typeof curr.className === "string") {
              cl = curr.className.toLowerCase();
            }
            if (curr.id && typeof curr.id === "string") {
              id = curr.id.toLowerCase();
            }
            if (
              cl.includes("cart") || cl.includes("slip") || cl.includes("basket") || cl.includes("summary") || cl.includes("infolist") || cl.includes("selected-numbers") || cl.includes("reflist") || cl.includes("receipt") || cl.includes("queue") ||
              id.includes("cart") || id.includes("slip") || id.includes("basket") || id.includes("summary") || id.includes("infolist") || id.includes("selected-numbers") || id.includes("reflist") || id.includes("receipt") || id.includes("queue")
            ) {
              return true;
            }
            if (cl.includes("header") || cl.includes("footer") || cl.includes("sidebar") || id.includes("header") || id.includes("footer") || id.includes("sidebar")) {
              return true;
            }
            curr = curr.parentElement;
          }
          return false;
        };
        let count = 0;
        for(const bet of bets){
          showMsg("正在處理第 " + (count+1) + " 注...");
          try {
            const playTypeXps = [
              "//*[normalize-space(.)='膽拖' and (self::a or self::button or self::input or @role='button' or contains(@class, 'btn') or contains(@class, 'tab'))]",
              "//*[normalize-space(text())='膽拖' or @value='膽拖' or @alt='膽拖']",
              "//*[normalize-space(text())='Banker-Legs' or @value='Banker-Legs']",
              "//*[normalize-space(text())='Bankers-Legs' or @value='Bankers-Legs']"
            ];
            for(let xp of playTypeXps) {
              const els = document.evaluate(xp, document, null, 7, null);
              for(let j=0; j<els.snapshotLength; j++){
                const el = els.snapshotItem(j);
                const rect = el.getBoundingClientRect();
                if (!isInCart(el) && el.tagName !== 'BODY' && el.tagName !== 'HTML' && rect.height > 0) {
                  triggerClick(el);
                }
              }
            }
          } catch(e){}
          await sleep(1000);

          for (const section of ['bankers', 'legs']) {
            const arr = bet[section];
            if (!arr || arr.length === 0) continue;
            
            try {
              const xps = section === 'bankers' 
                ? [
                    "//*[contains(translate(normalize-space(.), ' ', ''), '膽') and (self::a or self::button or self::input or @role='button' or contains(@class, 'tab') or contains(@class, 'btn')) and not(contains(normalize-space(.), '拖'))]",
                    "//*[(contains(normalize-space(.), '膽') or contains(normalize-space(.), '膽拖')) and (self::a or self::button or self::input or @role='button' or contains(@class, 'tab') or contains(@class, 'btn'))]",
                    "//*[normalize-space(text())='膽' or @value='膽' or @alt='膽']",
                    "//*[contains(text(), '膽')]"
                  ] 
                : [
                    "//*[(contains(normalize-space(.), '配腳') or contains(normalize-space(.), '腳') or contains(normalize-space(.), '拖')) and not(contains(normalize-space(.), '膽')) and (self::a or self::button or self::input or @role='button' or contains(@class, 'tab') or contains(@class, 'btn'))]",
                    "//*[normalize-space(text())='配腳' or normalize-space(text())='腳' or @value='配腳' or @alt='配腳']",
                    "//*[(contains(normalize-space(.), '配腳') or contains(normalize-space(.), '腳') or contains(normalize-space(.), '拖')) and not(contains(normalize-space(.), '膽'))]"
                  ];
                
              for (let xp of xps) {
                const els = document.evaluate(xp, document, null, 7, null);
                let clickedTab = false;
                for(let i=0; i<els.snapshotLength; i++){
                  const el = els.snapshotItem(i);
                  const rect = el.getBoundingClientRect();
                  if (!isInCart(el) && el.tagName !== 'BODY' && el.tagName !== 'HTML' && rect.height > 0) {
                    triggerClick(el);
                    clickedTab = true;
                  }
                }
                if (clickedTab) break;
              }
            } catch(e){}
            await sleep(800);

            for(const num of arr){
              const str = num.toString();
              const pad = num < 10 ? '0'+num : str;
              let clicked = false;
              let validEls = [];
              try {
                const xpsBall = [
                  "//*[(normalize-space(text())='"+str+"' or normalize-space(text())='"+pad+"') and not(*)]",
                  "//*[(normalize-space(.)='"+str+"' or normalize-space(.)='"+pad+"')]"
                ];
                for(let xp of xpsBall) {
                  const els = document.evaluate(xp, document, null, 7, null);
                  for(let i=0; i<els.snapshotLength; i++){
                    const el = els.snapshotItem(i);
                    const rect = el.getBoundingClientRect();
                    if(rect.width > 0 && rect.height > 0){
                      if (isInCart(el)) continue;
                      
                      let hasChildrenText = false;
                      for(let c of el.children) {
                        if(c.textContent.trim().length > 0 && c.textContent.trim() !== str && c.textContent.trim() !== pad) {
                          hasChildrenText = true;
                        }
                      }
                      if (hasChildrenText) continue;
                      
                      if (rect.width >= 20 && rect.width <= 150 && rect.height >= 20 && rect.height <= 150) {
                        const elClass = (el.className || '').toString().toLowerCase();
                        if (elClass.includes('ball') || elClass.includes('num') || el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'BUTTON') {
                          validEls.push(el);
                        }
                      }
                    }
                  }
                }
                
                if(validEls.length > 0){ 
                  const targetEl = section === 'bankers' ? validEls[0] : validEls[validEls.length - 1];
                  triggerClick(targetEl); 
                  clicked = true;
                }
              } catch(e){}
              
              if (!clicked) {
                showMsg("找不到號碼: " + str);
              }
              await sleep(600);
            }
          }
          
          showMsg("添加注項...");
          await sleep(1500);
          
          let clickedAdd = false;
          try {
              const exactXp = "//*[normalize-space(.)='添加到投注區' or normalize-space(.)='加入注項' or normalize-space(.)='確定' or normalize-space(.)='加入' or @alt='添加到投注區' or @alt='加入注項'] | //*[contains(translate(text(), ' ', ''), '添加到投注區') or contains(translate(text(), ' ', ''), '加入注項')]";
              const exactEls = document.evaluate(exactXp, document, null, 7, null);
              for(let i=exactEls.snapshotLength - 1; i>=0; i--){
                const el = exactEls.snapshotItem(i);
                const rect = el.getBoundingClientRect();
                if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                  triggerClick(el); 
                  clickedAdd = true; 
                  break; 
                }
              }
          } catch(e){}
          
          if (!clickedAdd) {
            try {
              const fallbackXp = "//*[contains(text(), '添加到投注區') or contains(text(), '加入注項') or contains(text(), '確定') or contains(text(), '加入')]";
              const fallbackEls = document.evaluate(fallbackXp, document, null, 7, null);
              for(let i=fallbackEls.snapshotLength - 1; i>=0; i--){
                const el = fallbackEls.snapshotItem(i);
                const rect = el.getBoundingClientRect();
                if(rect.width > 0 && rect.height > 0 && el.tagName !== 'BODY' && el.tagName !== 'HTML'){ 
                  triggerClick(el); clickedAdd = true; break; 
                }
              }
            } catch(e){}
          }
          
          if(clickedAdd) count++;
          await sleep(4000);
        }
        showMsg("手機版點擊完成！共嘗試輸入 " + count + " 注。");
        setTimeout(() => alert("手機版點擊完成！共嘗試輸入 " + count + " 注。請核對投注區內容。"), 1000);
      })();\`;
      return \`javascript:\${encodeURIComponent(script)}\`;
    }
  };
`;

  const finalCode = code.substring(0, sIdx) + newSegment + code.substring(eIdx);
  fs.writeFileSync('src/App.tsx', finalCode);
  console.log("Success! Applied patch to src/App.tsx");
} else {
  console.log("Could not find boundaries.");
}
