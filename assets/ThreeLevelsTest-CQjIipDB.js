import{r as i,j as e,bp as $,bo as I,bn as L,aR as W,ca as D}from"./index-1x3sw4DL.js";const T=`
המגוון הביולוגי בסכנה

בשנת 1831 עגנה ספינתו של צ'רלס דרווין לפני חופי באייה שבברזיל. יערות הגשם החופיים שבהם ביקר, הותירו רושם בל יימחה על דרווין, וכך הוא כתב ביומנו:
"תענוג... הוא ביטוי חלש מדי להביע את עוצמת הרגשות של איש טבע המשוטט לראשונה ביער הברזילאי."

מן היער שעורר את התפעלותו של דרווין, נותרו היום פחות מ-10% מהיצורים החיים. תהליכים ישירים ועקיפים של הרס נופים טבעיים בידי האדם.

הרס ישיר נגרם, למשל, כאשר כורתים יער. הרס עקיף נגרם בדרכים מורכבות יותר. לדוגמה, כאשר האדם מדשן את השדות, לעיתים כמויות הדשן נסחפות עם מי הגשמים למקורות מים.

הדישון הכרחי, כי בלעדיו לא יהיה די יבול לפרנסת האדם, אך בעקיפין הוא פוגע בבתי הגידול של יצורים אחרים.
`,f={הבנה:{label:"הבנה",icon:L,color:"#2196F3",bgColor:"#E3F2FD",instructions:`רמת קושי: הבנה - לתלמידים מתקשים

עקרונות חובה:
1. שפה פשוטה מאוד - משפטים קצרים (עד 10 מילים)
2. שאלות ישירות - התשובה מופיעה במפורש בטקסט
3. מסיחים (תשובות שגויות) - ברורים כשגויים, קל לפסול אותם
4. רמזים - 3 רמזים פרוגרסיביים לכל שאלה
5. רמות בלום: Remember, Understand בלבד
6. סוגי שאלות: בחירה מרובה פשוטה, נכון/לא נכון`,temperature:.3},יישום:{label:"יישום",icon:I,color:"#FF9800",bgColor:"#FFF3E0",instructions:`רמת קושי: יישום - לתלמידים טיפוסיים

עקרונות חובה:
1. שפה מותאמת - משפטים עד 15 מילים
2. דורש הבנה - לא רק איתור מידע, אלא הבנת משמעות
3. מסיחים אמינים - דורשים חשיבה להבחנה
4. ללא רמזים אוטומטיים
5. רמות בלום: Understand, Apply, Analyze
6. סוגי שאלות: בחירה מרובה, השוואה, מיון`,temperature:.5},העמקה:{label:"העמקה",icon:$,color:"#F44336",bgColor:"#FFEBEE",instructions:`רמת קושי: העמקה - לתלמידים מתקדמים

עקרונות חובה:
1. שפה אקדמית - מורכבות לשונית גבוהה
2. חשיבה ביקורתית - הערכה, סינתזה, יצירה
3. מסיחים - כולם נראים אמינים, דורשים ניתוח מעמיק
4. שאלות "למה" ו"איך" - לא רק "מה"
5. חיבור למושגים מתקדמים או רחבים יותר
6. רמות בלום: Analyze, Evaluate, Create
7. סוגי שאלות: שאלות פתוחות, ניתוח, הערכה`,temperature:.7}},U=()=>{const[m,u]=i.useState(T),[o,k]=i.useState(5),[p,y]=i.useState([]),[d,j]=i.useState(!1),[R,F]=i.useState(null),[v,x]=i.useState(0),[C,w]=i.useState(null),[g,h]=i.useState(!1),S=i.useRef(null),A=async t=>{const n=await t.arrayBuffer(),s=await W({data:n}).promise;let r="";for(let l=1;l<=s.numPages;l++){const c=(await(await s.getPage(l)).getTextContent()).items.map(_=>_.str).join(" ");r+=c+`

`}return r.trim()},E=async t=>{var s;const n=(s=t.target.files)==null?void 0:s[0];if(n){h(!0),w(n.name);try{let r="";if(n.type==="application/pdf"||n.name.endsWith(".pdf"))r=await A(n);else if(n.type==="text/plain"||n.name.endsWith(".txt"))r=await n.text();else{alert("סוג קובץ לא נתמך. אנא העלה PDF או TXT"),h(!1);return}r&&u(r)}catch(r){console.error("File extraction error:",r),alert(r.message||"שגיאה בחילוץ טקסט מהקובץ")}finally{h(!1)}}},B=async t=>{const n=f[t],s=`
אתה מומחה פדגוגי ליצירת פעילויות לימודיות. צור פעילות של ${o} שאלות בעברית.

טקסט מקור:
${m}

${n.instructions}

צור בדיוק ${o} שאלות מגוונות (לא רק בחירה מרובה - גם נכון/לא נכון, השלמה, וכו').

החזר JSON בלבד:
{
    "questions": [
        {
            "questionNumber": 1,
            "question": "נוסח השאלה",
            "questionType": "multiple_choice | true_false | fill_blank",
            "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
            "correctAnswer": "התשובה הנכונה",
            "hints": ["רמז 1", "רמז 2", "רמז 3"],
            "bloomLevel": "Remember | Understand | Apply | Analyze | Evaluate | Create"
        }
    ]
}

חשוב:
- צור בדיוק ${o} שאלות
- כל שאלה חייבת להתאים לרמת הקושי ${n.label}
- גוון בסוגי השאלות
`,r=await D([{role:"user",content:s}],{temperature:n.temperature});return{level:t,levelLabel:n.label,questions:r.questions||[]}},z=async()=>{j(!0),y([]),x(0);const t=["הבנה","יישום","העמקה"],n=[];for(let s=0;s<t.length;s++){const r=t[s];F(f[r].label),x(Math.round(s/3*100));try{const l=await B(r);n.push(l),y([...n])}catch(l){console.error(`Error generating ${r}:`,l)}}x(100),F(null),j(!1)};return e.jsxs("div",{dir:"rtl",style:{padding:"2rem",maxWidth:"1400px",margin:"0 auto",fontFamily:"Arial, sans-serif"},children:[e.jsx("h1",{style:{borderBottom:"3px solid #333",paddingBottom:"0.5rem"},children:"🧪 בדיקת פעילות בשלוש רמות קושי"}),e.jsxs("p",{style:{color:"#666"},children:["כלי זה מייצר פעילות שלמה (",o," שאלות) בשלוש רמות קושי שונות להשוואה"]}),e.jsxs("div",{style:{background:"#f5f5f5",padding:"1.5rem",borderRadius:"12px",marginBottom:"1.5rem"},children:[e.jsx("h3",{style:{marginTop:0},children:"⚙️ הגדרות"}),e.jsxs("div",{style:{marginBottom:"1rem"},children:[e.jsx("label",{style:{fontWeight:"bold",display:"block",marginBottom:"0.5rem"},children:"מספר שאלות בפעילות:"}),e.jsx("div",{style:{display:"flex",gap:"1rem"},children:[3,5,7].map(t=>e.jsxs("button",{onClick:()=>k(t),style:{padding:"0.5rem 1.5rem",border:o===t?"2px solid #4CAF50":"2px solid #ddd",borderRadius:"8px",background:o===t?"#E8F5E9":"white",cursor:"pointer",fontWeight:o===t?"bold":"normal"},children:[t," שאלות (",t===3?"קצר":t===5?"בינוני":"ארוך",")"]},t))})]}),e.jsxs("div",{children:[e.jsx("label",{style:{fontWeight:"bold",display:"block",marginBottom:"0.5rem"},children:"📄 טקסט מקור:"}),e.jsxs("div",{style:{marginBottom:"1rem",display:"flex",gap:"1rem",alignItems:"center"},children:[e.jsx("input",{type:"file",ref:S,onChange:E,accept:".pdf,.txt",style:{display:"none"}}),e.jsx("button",{onClick:()=>{var t;return(t=S.current)==null?void 0:t.click()},disabled:g,style:{padding:"0.75rem 1.5rem",background:g?"#ccc":"#2196F3",color:"white",border:"none",borderRadius:"8px",cursor:g?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:"0.5rem"},children:g?"⏳ מחלץ טקסט...":"📁 העלה קובץ (PDF / TXT)"}),C&&e.jsxs("span",{style:{background:"#E3F2FD",padding:"0.5rem 1rem",borderRadius:"8px",fontSize:"0.9rem"},children:["✅ ",C]}),e.jsx("button",{onClick:()=>{u(T),w(null)},style:{padding:"0.5rem 1rem",background:"#fff",border:"1px solid #ddd",borderRadius:"8px",cursor:"pointer",fontSize:"0.85rem"},children:"🔄 איפוס לטקסט ברירת מחדל"})]}),e.jsx("textarea",{value:m,onChange:t=>u(t.target.value),style:{width:"100%",minHeight:"150px",padding:"1rem",borderRadius:"8px",border:"1px solid #ddd",fontFamily:"inherit",fontSize:"0.95rem",resize:"vertical"},placeholder:"הדבק כאן טקסט או העלה קובץ..."}),e.jsxs("p",{style:{fontSize:"0.8rem",color:"#888",marginTop:"0.5rem"},children:[m.length," תווים | ~",Math.round(m.split(/\s+/).length)," מילים"]})]})]}),e.jsx("button",{onClick:z,disabled:d,style:{padding:"1rem 3rem",fontSize:"1.2rem",background:d?"#ccc":"linear-gradient(135deg, #4CAF50, #45a049)",color:"white",border:"none",borderRadius:"12px",cursor:d?"not-allowed":"pointer",marginBottom:"2rem",boxShadow:d?"none":"0 4px 15px rgba(76, 175, 80, 0.3)"},children:d?e.jsxs("span",{children:["⏳ מייצר ",R,"... (",v,"%)"]}):e.jsxs("span",{children:["🚀 הרץ בדיקה - צור ",o*3," שאלות (3 רמות × ",o,")"]})}),d&&e.jsx("div",{style:{marginBottom:"2rem"},children:e.jsx("div",{style:{background:"#ddd",borderRadius:"10px",height:"20px",overflow:"hidden"},children:e.jsx("div",{style:{background:"linear-gradient(90deg, #4CAF50, #8BC34A)",height:"100%",width:`${v}%`,transition:"width 0.3s ease"}})})}),p.length>0&&e.jsxs("div",{children:[e.jsxs("h2",{children:["📊 תוצאות - השוואה בין ",p.length," רמות"]}),e.jsx("div",{style:{display:"grid",gridTemplateColumns:`repeat(${p.length}, 1fr)`,gap:"1rem"},children:p.map((t,n)=>{const s=f[t.level];return e.jsxs("div",{style:{background:s.bgColor,borderRadius:"12px",padding:"1rem",border:`2px solid ${s.color}`},children:[e.jsxs("h3",{style:{color:s.color,marginTop:0,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"},children:[e.jsx(s.icon,{className:"w-6 h-6"}),s.label]}),e.jsxs("p",{style:{textAlign:"center",fontSize:"0.9rem",color:"#666"},children:[t.questions.length," שאלות"]}),t.questions.map((r,l)=>{var b;return e.jsxs("div",{style:{background:"white",borderRadius:"8px",padding:"1rem",marginBottom:"1rem",boxShadow:"0 2px 4px rgba(0,0,0,0.1)"},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.5rem"},children:[e.jsxs("strong",{style:{color:s.color},children:["שאלה ",r.questionNumber]}),e.jsx("span",{style:{background:"#eee",padding:"2px 8px",borderRadius:"4px",fontSize:"0.75rem"},children:r.bloomLevel})]}),e.jsx("p",{style:{fontWeight:"500",marginBottom:"0.5rem"},children:r.question}),e.jsx("ol",{style:{margin:0,paddingRight:"1.2rem",fontSize:"0.9rem"},children:(b=r.options)==null?void 0:b.map((a,c)=>e.jsxs("li",{style:{color:a===r.correctAnswer?"#4CAF50":"#333",fontWeight:a===r.correctAnswer?"bold":"normal",marginBottom:"0.25rem"},children:[a," ",a===r.correctAnswer&&"✓"]},c))}),r.hints&&r.hints.length>0&&t.level==="הבנה"&&e.jsxs("div",{style:{marginTop:"0.5rem",padding:"0.5rem",background:"#FFF9C4",borderRadius:"4px",fontSize:"0.8rem"},children:[e.jsx("strong",{children:"💡 רמזים:"}),r.hints.map((a,c)=>e.jsxs("div",{children:[c+1,". ",a]},c))]})]},l)})]},n)})})]})]})};export{U as ThreeLevelsTest,U as default};
//# sourceMappingURL=ThreeLevelsTest-CQjIipDB.js.map
