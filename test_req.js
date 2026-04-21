const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

fetch("http://localhost:3000/api/check-screenshot", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ imageBase64: dummyBase64 })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
