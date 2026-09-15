const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const key = 'new-era-prompt-lab-v7';
function boot(saved, blocked = false, configured = false) {
  const elements = new Map(), stored = new Map(saved ? [[key, saved]] : []);
  const el = id => {
    if (!elements.has(id)) elements.set(id, {innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},querySelector(){return null},focus(){},scrollIntoView(){},addEventListener(){},setAttribute(){}});
    return elements.get(id);
  };
  const context = {console,setTimeout:()=>0,clearTimeout(){},navigator:{clipboard:{writeText:async()=>{}}},document:{getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],body:el('body')},localStorage:{getItem:k=>{if(blocked)throw Error();return stored.get(k)||null},setItem:(k,v)=>{if(blocked)throw Error();stored.set(k,v)}}};
  vm.createContext(context);
  const code=configured?source.replace("const HOMEWORK_URL='';","const HOMEWORK_URL='https://example.org/homework';").replace("const APPLICATION_URL='';","const APPLICATION_URL='https://example.org/apply';"):source;
  vm.runInContext(code.replace('save();render();\n', 'save();render();\nglobalThis.qa={state,scenes,current,start,fieldNext,prompt,render,save};\n'), context);
  return {...context.qa,el,stored};
}
let checks = 0;
function check(value, message) {assert.ok(value, message); checks++;}
let a = boot();
a.start(); check(a.state.stage===0,'starting without a scenario gives guidance');
const lengths = [];
for (const [id, s] of Object.entries(a.scenes)) {
  check(s.rounds.length===2&&s.fields.length===3,'two connected exercises and three fields');
  check(s.rounds[0].after===s.rounds[1].before,'second exercise continues the same example');
  for (const q of s.rounds) {
    for (const [items,index] of [[q.problems,q.problem],[q.fixes,q.fix]]) {
      check(items.length===3&&items[index],'three valid choices');
      lengths.push(items[index].length===Math.max(...items.map(x=>x.length)));
    }
    check(q.reason&&q.why&&q.takeaway&&q.instruction,'every choice has teaching feedback');
  }
  a.state.scene=id; a.state.stage=0; a.start();
  for(let round=0;round<2;round++) {
    const r=a.current(); r.problem=(s.rounds[round].problem+1)%3; a.render();
    check(a.el('content').innerHTML.includes('Посмотри на отмеченную проблему'),'wrong answer is explained');
    a.el('to-fix').onclick(); r.fix=(s.rounds[round].fix+1)%3; a.render();
    a.el('apply-fix').onclick(); check(r.phase==='result','wrong choice can use the explanation');
    a.el('round-next').onclick();
  }
  check(a.state.stage===2,'both exercises lead to same scenario personal fields');
  a.current().values[0]='   '; a.fieldNext(); check(a.current().field===0,'whitespace gives explicit guidance');
  const values=['  Проверка <img src=x>  ','Условия «А»','Мой следующий шаг'];
  for(let i=0;i<3;i++){a.current().values[i]=values[i];a.fieldNext();}
  check(a.state.stage===3,'three short answers build final prompt');
  check(a.el('content').innerHTML.includes('Домашка выполнена.'),'completion is immediate without external chat');
  check(!/chatgpt|data-review|ИИ-чат/i.test(a.el('content').innerHTML),'no external chat or evaluation requirement');
  a.save(); const withForms=boot(a.stored.get(key),false,true).el('content').innerHTML;
  check(withForms.includes('https://example.org/homework')&&withForms.includes('https://example.org/apply'),'separate configured submission and application destinations');
  check(withForms.includes('Чтобы домашку приняли')&&!withForms.includes('Домашка принята'),'completion does not claim submission was accepted');
  for(const value of values)check(a.prompt().includes(value.trim()),'own answer preserved');
  check(a.el('content').innerHTML.includes('&lt;img src=x&gt;'),'input rendered as text');
  check(!a.el('content').innerHTML.includes('mailto:'),'no email application fallback');
  a.save();const restored=boot(a.stored.get(key));check(restored.state.stage===3&&restored.prompt()===a.prompt(),'reload preserves complete prompt');
  a.el('edit-own').onclick();check(a.current().field===0,'editing starts with first field');
  a.el('field-back').onclick();a.el('round-next').onclick();check(a.state.stage===2&&a.current().values[1]===values[1],'back to lesson and forward preserves answers');
}
check(lengths.filter(Boolean).length<lengths.length/2,'longest-answer strategy fails on most questions');
check(boot('broken').state.stage===0,'malformed storage recovers');
check(boot(null,true).state.stage===0,'storage disabled still works');
for(const scene of ['missing','toString','constructor'])check(boot(JSON.stringify({stage:3,scene})).state.stage===0,'unknown scenario recovers');
const unfinished=boot(JSON.stringify({stage:3,scene:'post',records:{post:{round:0}}}));
check(unfinished.state.stage===1,'incomplete learning resumes at lesson');
check(!html.includes('mailto:'),'published HTML has no email CTA');
console.log(`${checks} checks passed. Longest correct answers: ${lengths.filter(Boolean).length}/${lengths.length}.`);
