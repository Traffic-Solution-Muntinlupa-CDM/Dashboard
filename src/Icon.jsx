export default function Icon({ name }) {
  const paths = {
    overview: <><path d="M4 5h7v6H4zM13 5h7v10h-7zM4 13h7v6H4zM13 17h7v2h-7z" /></>,
    chart: <><path d="M4 19V9m5 10V5m6 14v-7m5 7V3" /><path d="M3 19h18" /></>,
    signal: <><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3m0-14-3 3M8 16l-3 3" /></>,
    bolt: <><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" /></>,
    tools: <><path d="m14 6 4-4 4 4-4 4M18 2v8M4 21l7-7" /><path d="M13 13 8 8 3 9l-1-1 6-6 1 1-1 5 5 5" /></>,
    log: <><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5" /></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}
