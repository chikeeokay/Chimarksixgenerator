const res = await fetch('https://www.lotteryextreme.com/hongkong/results');
const text = await res.text();
console.log(text.slice(0, 1000));
