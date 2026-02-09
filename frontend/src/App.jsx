import { useEffect, useState } from "react";

function App() {
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    fetch("http://localhost:3000/api/sheets/ping")
      .then(res => res.json())
      .then(data => {
        console.log("Respuesta backend:", data);
        setMensaje(data.appscript);
      });
  }, []);

  return (
    <div>
      <h1>React + Express</h1>
      <p>{mensaje}</p>
    </div>
  );
}

export default App;
