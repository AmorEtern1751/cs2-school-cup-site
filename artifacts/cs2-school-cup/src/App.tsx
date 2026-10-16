import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { Activity, AlertTriangle, ArrowDownToLine, CalendarDays, ChevronRight, CircleHelp, ClipboardList, ExternalLink, Info, Save, Shield, Swords, Users, X } from 'lucide-react';
import { initialState, Match, MatchStatus, PlayerStat, resolveMatch, RoundKey, roundNames, scoreLabel, STORAGE_KEY, Team, TournamentState } from './tournament';

const queryClient = new QueryClient();
type Filter = 'Все' | MatchStatus;
type AdminTab = 'matches' | 'teams' | 'players';

function useTournament() {
  const [savedSnapshot] = useState((): { state: TournamentState; warning: string } => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TournamentState;
        if (Array.isArray(parsed.teams) && Array.isArray(parsed.matches)) {
          return { state: parsed, warning: '' };
        }
        return { state: initialState, warning: 'Сохранённые данные повреждены: загружен исходный демонстрационный набор.' };
      }
    } catch {
      return { state: initialState, warning: 'Не удалось прочитать сохранённые данные: загружен исходный демонстрационный набор.' };
    }
    return { state: initialState, warning: '' };
  });
  const [state, setState] = useState<TournamentState>(savedSnapshot.state);
  const [storageWarning, setStorageWarning] = useState(savedSnapshot.warning);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageWarning('');
    } catch {
      setStorageWarning('Не удалось сохранить изменения в этом браузере. Проверьте настройки хранилища.');
    }
  }, [state]);
  const updateMatch = (id: string, patch: Partial<Match>) => setState(current => ({
    ...current, matches: current.matches.map(match => match.id === id ? { ...match, ...patch } : match),
  }));
  const updateTeam = (id: string, patch: Partial<Team>) => setState(current => ({
    ...current, teams: current.teams.map(team => team.id === id ? { ...team, ...patch } : team),
  }));
  const reset = () => setState(initialState);
  return { state, setState, updateMatch, updateTeam, reset, storageWarning };
}

function TeamMark({team,size='normal'}:{team?:Team;size?:'normal'|'large'}) {
  return <span className={`team-logo ${size==='large'?'team-logo-large':''}`} style={{borderColor:team?.color,color:team?.color}} data-testid={team?`team-logo-${team.id}`:'team-logo-empty'}>{team?.short ?? '—'}</span>;
}
function StatusBadge({status}:{status:MatchStatus}) {
  return <span className={`badge ${status==='LIVE'?'live':status==='Завершён'?'done':''}`} data-testid={`status-match-${status.toLowerCase().replace('ё','e')}`}>{status==='LIVE'&&<span className="dot-live"/>}{status}</span>;
}
function Header({admin=false}:{admin?:boolean}) {
  return <header className="topbar">
    <Link href="/" className="brand" data-testid="link-home"><span className="brand-mark">К</span><span>КУБОК ШКОЛЫ<small>CS2 · ОСЕННИЙ СЕЗОН 2026</small></span></Link>
    <nav className="navlinks" aria-label="Основная навигация">
      <Link href="/" className={!admin?'active':''} data-testid="link-tournament">Турнир</Link>
      <a href="/#schedule" data-testid="link-schedule">Расписание</a>
      <a href="/#bracket" data-testid="link-bracket">Сетка</a>
      <Link href="/admin" className={admin?'active':''} data-testid="link-admin">Управление</Link>
    </nav>
    <div className="nav-meta"><span className="dot-live"/><span>16 команд · демо-турнир</span></div>
  </header>;
}
function DemoNotice({storageWarning}:{storageWarning?:string}) {
  return <div className="demo-notices">
    <div className="demo-note" data-testid="notice-demo-data"><Info size={15}/><span><b>Демонстрационные данные.</b> Игровые серверы и трансляции в реальном времени не подключены. Изменения управления хранятся только в этом браузере.</span></div>
    {storageWarning&&<div className="error-state storage-error" role="alert" data-testid="error-local-storage"><AlertTriangle size={14}/>{storageWarning}</div>}
  </div>;
}

function isTwitchUrl(value?:string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['twitch.tv','www.twitch.tv'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function MatchCard({match,state,onOpen}:{match:Match;state:TournamentState;onOpen:(match:Match)=>void}) {
  const teams=resolveMatch(state,match);
  return <article className="match-card" onClick={()=>onOpen(match)} onKeyDown={event=>event.key==='Enter'&&onOpen(match)} role="button" tabIndex={0} data-testid={`card-match-${match.id}`}>
    <div className="match-time"><strong>{match.time}</strong><small>{new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','')}</small></div>
    <div className="match-teams">
      {[{team:teams.a,side:'a' as const},{team:teams.b,side:'b' as const}].map(({team,side})=><div className={`team-line ${teams.winner===team?'winner':''} ${teams.loser===team?'loser':''}`} key={side}>
        <TeamMark team={team}/><span className="name">{team?.name ?? 'Победитель пары'}</span><span className="team-score">{match.maps.length?match.maps.reduce((n,map)=>n+(map[side]>map[side==='a'?'b':'a']?1:0),0):''}</span>
      </div>)}
    </div>
    <div className="match-state"><StatusBadge status={match.status}/><small>{roundNames[match.round]}</small></div>
  </article>;
}

function Bracket({state,onOpen}:{state:TournamentState;onOpen:(match:Match)=>void}) {
  const rounds:RoundKey[]=['r16','qf','sf','third','final'];
  return <div className="bracket-wrap" data-testid="bracket-all-rounds"><div className="bracket">
    {rounds.map(round=><section className="round-column" key={round}>
      <h3 className="round-title">{roundNames[round]}</h3>
      <div className="round-matches">{state.matches.filter(match=>match.round===round).map(match=>{
        const resolved=resolveMatch(state,match);
        return <article className="bracket-card" key={match.id} onClick={()=>onOpen(match)} role="button" tabIndex={0} onKeyDown={event=>event.key==='Enter'&&onOpen(match)} data-testid={`bracket-match-${match.id}`}>
          {[{team:resolved.a,side:'a' as const},{team:resolved.b,side:'b' as const}].map(({team,side})=><div className={`bracket-team ${resolved.winner===team?'winner':''}`} key={side}>
            <TeamMark team={team}/><span className="name">{team?.name??'Ожидает участника'}</span><span className="team-score">{match.maps.length?match.maps.filter(map=>map[side]>map[side==='a'?'b':'a']).length:'·'}</span>
          </div>)}
          <div style={{position:'absolute',right:6,top:-7,transform:'translateY(-100%)'}}><StatusBadge status={match.status}/></div>
        </article>;
      })}</div>
    </section>)}
  </div></div>;
}

function MatchDetail({match,state,onClose}:{match:Match;state:TournamentState;onClose:()=>void}) {
  const resolved=resolveMatch(state,match);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>event.key==='Escape'&&onClose();window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  return <div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&onClose()} data-testid="dialog-match-detail">
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="match-dialog-title">
      <div className="modal-head"><div><div className="eyebrow">{roundNames[match.round]} · {new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'long'})} · {match.time}</div><h2 id="match-dialog-title">Матч {match.number} <span style={{marginLeft:8}}><StatusBadge status={match.status}/></span></h2></div><button className="icon-btn" onClick={onClose} aria-label="Закрыть" data-testid="button-close-match"><X size={16}/></button></div>
      <div className="modal-body">
        <div className="versus">
          <div className="versus-team"><TeamMark team={resolved.a} size="large"/><span>{resolved.a?.name??'Участник определится позже'}</span></div>
          <div className="versus-score">{scoreLabel(match)}</div>
          <div className="versus-team"><span>{resolved.b?.name??'Участник определится позже'}</span><TeamMark team={resolved.b} size="large"/></div>
        </div>
        <div className="detail-grid">
          <div className="detail-box"><h4>Карты · BO{match.round==='final'?5:3}</h4>{match.maps.length?match.maps.map((map,index)=><div className="map-row" key={`${map.map}-${index}`}><span>{map.map}{match.currentMap===map.map?' · ТЕКУЩАЯ':''}</span><strong>{map.a} : {map.b}</strong></div>):<div className="map-row"><span>Счёт карт появится после игры</span><span>—</span></div>}
            {match.currentMap&&<div className="map-row" style={{color:'#f2762c'}}><span>Текущая карта · раунд</span><strong>{match.currentMap} · {match.currentRound||'раунд не указан'}</strong></div>}
          </div>
          <div className="detail-box"><h4>Встреча</h4><div className="map-row"><span>Дата и время</span><strong>{new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} · {match.time}</strong></div><div className="map-row"><span>Формат</span><strong>BO{match.round==='final'?5:3}</strong></div><div className="map-row"><span>Арена</span><strong>Школьный компьютерный класс</strong></div>
             {isTwitchUrl(match.twitch)&&<a className="primary-btn" href={match.twitch} target="_blank" rel="noreferrer" data-testid={`link-twitch-${match.id}`} style={{marginTop:12}}><ExternalLink size={13}/>Открыть трансляцию на Twitch</a>}
          </div>
           <div className="detail-box" style={{gridColumn:'1 / -1'}}><h4>Игроки · статистика матча</h4>{match.players.length?<div style={{overflowX:'auto'}}><table className="players-table"><thead><tr><th>Игрок</th><th title="Убийства">Уб.</th><th title="Смерти">См.</th><th title="Помощи">Пом.</th><th>ADR</th><th title="Попадания в голову">В голову</th><th>MVP</th></tr></thead><tbody>{match.players.map((player,index)=><tr key={`${player.name}-${index}`}><td>{player.name} <span style={{color:'#81858b'}}>· {state.teams.find(team=>team.id===player.teamId)?.short}</span></td><td>{player.kills}</td><td>{player.deaths}</td><td>{player.assists}</td><td>{player.adr}</td><td>{player.hs}%</td><td>{player.mvp}</td></tr>)}</tbody></table></div>:<div className="map-row"><span>Статистика появится после внесения данных</span><span>—</span></div>}</div>
        </div>
        <div className="modal-actions"><button className="soft-btn" onClick={onClose} data-testid="button-dismiss-match">Закрыть</button></div>
      </div>
    </section>
  </div>;
}

function Home({state,storageWarning}:{state:TournamentState;storageWarning:string}) {
  const [filter,setFilter]=useState<Filter>('Все');
  const [selected,setSelected]=useState<Match|null>(null);
  const [roundFilter,setRoundFilter]=useState<RoundKey|'Все'>('Все');
  const matches=state.matches;
  const visible=matches.filter(match=>(filter==='Все'||match.status===filter)&&(roundFilter==='Все'||match.round===roundFilter));
  const live=state.matches.filter(match=>match.status==='LIVE');
  const upcoming=state.matches.filter(match=>match.status==='Скоро').slice(0,4);
  const completed=state.matches.filter(match=>match.status==='Завершён').length;
  const calendar=[...new Set(matches.map(match=>match.date))].sort().map(date=>{
    const dayMatches=matches.filter(match=>match.date===date);
    const dayRounds=[...new Set(dayMatches.map(match=>roundNames[match.round]))];
    const formats=[...new Set(dayMatches.map(match=>match.round==='final'?'BO5':'BO3'))];
    return {date,dayMatches,dayRounds,formats};
  });
  return <main className="page-wrap">
    <section className="hero">
      <div><div className="eyebrow">Открытый школьный чемпионат · сезон 2026</div><h1>Играем<br/><span>за свой класс.</span></h1><p className="hero-sub">Шестнадцать команд. Одна сетка. Большой финал на большой перемене — следи за ходом кубка и результатами каждой встречи.</p></div>
      <div className="hero-side"><strong>10—31 окт</strong><small>2026 · ДЕМО-СЕЗОН</small></div>
    </section>
    <section className="scoreboard" aria-label="Показатели турнира">
      <div className="stat-block"><div className="stat-label">Команды</div><div className="stat-value">16 <em>/ 16</em></div></div>
      <div className="stat-block"><div className="stat-label">Матчей сыграно</div><div className="stat-value">{completed} <em>/ 16</em></div></div>
      <div className="stat-block"><div className="stat-label">Сейчас в игре</div><div className="stat-value">{live.length ? <><span style={{color:'#f2762c'}}>{String(live.length).padStart(2,'0')}</span> <em>LIVE</em></>:'00'}</div></div>
      <div className="stat-block"><div className="stat-label">Формат</div><div className="stat-value">BO3 <em>· финал BO5</em></div></div>
    </section>
    <div className="content-grid">
      <div>
        <section id="schedule" className="section-anchor">
          <div className="section-heading"><div><div className="eyebrow">Смотреть ход турнира</div><h2>Матчи турнира</h2></div><small>{visible.length} МАТЧЕЙ</small></div>
          <div className="toolbar" aria-label="Фильтры матчей">
            {(['Все','LIVE','Скоро','Завершён'] as Filter[]).map(item=><button className={`filter-btn ${filter===item?'selected':''}`} key={item} onClick={()=>setFilter(item)} data-testid={`filter-status-${item.toLowerCase().replace('ё','e')}`}>{item}</button>)}
            <select value={roundFilter} onChange={event=>setRoundFilter(event.target.value as RoundKey|'Все')} className="filter-btn" aria-label="Фильтр по раунду" data-testid="filter-round"><option value="Все">Все раунды</option><option value="r16">1/8 финала</option><option value="qf">Четвертьфиналы</option><option value="sf">Полуфиналы</option><option value="third">Матч за 3-е место</option><option value="final">Гранд-финал</option></select>
          </div>
          {visible.length?<div className="match-list">{visible.map((match,index)=><div key={match.id} style={{animationDelay:`${index*35}ms`}}><MatchCard match={match} state={state} onOpen={setSelected}/></div>)}</div>:<div className="empty-state" data-testid="empty-matches">В этом фильтре пока нет матчей. Выбери другой статус.</div>}
        </section>
      </div>
      <aside className="side-panel">
        <section className="panel"><div className="panel-head"><h3><span style={{color:'#f2762c'}}>●</span> Сейчас на арене</h3><Activity size={15} color="#f2762c"/></div><div className="panel-body">
          {live.length?live.map(match=>{const pair=resolveMatch(state,match);return <div className="upcoming-row" key={match.id} onClick={()=>setSelected(match)} role="button" tabIndex={0} onKeyDown={event=>event.key==='Enter'&&setSelected(match)} data-testid={`live-match-${match.id}`}><span className="team-logo">{pair.a?.short??'?'}</span><div className="up-team">{pair.a?.name??'—'}<br/>{pair.b?.name??'—'}</div><span className="up-time"><StatusBadge status="LIVE"/></span></div>}):<div className="empty-state">Сейчас нет матчей в игре</div>}
        </div></section>
        <section className="panel" id="schedule-aside"><div className="panel-head"><h3>Ближайшие встречи</h3><CalendarDays size={15} color="#f2762c"/></div><div className="panel-body">
          {upcoming.map(match=>{const pair=resolveMatch(state,match);return <div className="upcoming-row" key={match.id} onClick={()=>setSelected(match)} role="button" tabIndex={0} data-testid={`upcoming-match-${match.id}`}><span className="team-logo">{pair.a?.short??'?'}</span><div className="up-team">{pair.a?.name??'Участник'}<br/>{pair.b?.name??'Участник'}</div><span className="up-time">{match.time}<br/>{new Date(`${match.date}T00:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}</span></div>})}
        </div></section>
        <section className="panel"><div className="panel-head"><h3>Календарь</h3><ClipboardList size={15} color="#f2762c"/></div><div className="panel-body">
          {calendar.map(({date,dayMatches,dayRounds,formats})=><div className="schedule-row" key={date}><div className="schedule-day">{new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}).replace('.','').toUpperCase()}</div><div><strong>{dayRounds.join(' · ')}</strong><small>Встреч: {dayMatches.length} · Формат: {formats.join(' / ')}</small></div></div>)}
        </div></section>
        <DemoNotice storageWarning={storageWarning}/>
      </aside>
    </div>
    <section id="bracket" className="section-anchor" style={{marginTop:38}}>
      <div className="section-heading"><div><div className="eyebrow">Путь к кубку</div><h2>Турнирная сетка</h2></div><small>ОДНО ПОРАЖЕНИЕ — ВЫЛЕТ</small></div>
      <div className="mobile-scroll-hint">ПРОКРУТИ СЕТКУ ПО ГОРИЗОНТАЛИ <ChevronRight size={11} style={{verticalAlign:'middle'}}/></div>
      <Bracket state={state} onOpen={setSelected}/>
    </section>
    {selected&&<MatchDetail match={selected} state={state} onClose={()=>setSelected(null)}/>}
  </main>;
}

function parseMaps(value:string):Match['maps'] {
  return value.split(',').map(part=>part.trim()).filter(Boolean).map((part,index)=>{
    const [scores,mapName]=part.split('@').map(item=>item.trim());
    const [a,b]=scores.split(/[-:]/).map(Number);
    return {map:mapName||['Mirage','Ancient','Inferno','Nuke','Dust2'][index%5],a:Number.isFinite(a)?a:0,b:Number.isFinite(b)?b:0};
  });
}
function isValidMapScoreText(value:string,round?:RoundKey) {
  if (!value.trim()) return true;
  const entries=value.split(',').map(part=>part.trim());
  if (round && entries.length > (round==='final'?5:3)) return false;
  return entries.every(part=>{
    const [score,mapName,...extra]=part.split('@').map(item=>item.trim());
    if (extra.length || !/^\d{1,2}[-:]\d{1,2}$/.test(score??'')) return false;
    const [a,b]=(score??'').split(/[-:]/).map(Number);
    if (a===b) return false;
    return !mapName || mapName.length <= 30;
  });
}
function hasSeriesWinner(maps:Match['maps'],round:RoundKey) {
  const winsNeeded=round==='final'?3:2;
  const winsA=maps.filter(map=>map.a>map.b).length;
  const winsB=maps.filter(map=>map.b>map.a).length;
  return winsA>=winsNeeded||winsB>=winsNeeded;
}
function mapText(match:Match) { return match.maps.map(map=>`${map.a}-${map.b}@${map.map}`).join(', '); }
function formatDateInput(value:string) {
  const date=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return date?`${date[3]}.${date[2]}.${date[1]}`:value;
}
function parseDateInput(value:string) {
  const date=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if(!date) return null;
  const [,dayText,monthText,yearText]=date;
  const day=Number(dayText),month=Number(monthText),year=Number(yearText);
  const checked=new Date(Date.UTC(year,month-1,day));
  if(checked.getUTCDate()!==day||checked.getUTCMonth()!==month-1||checked.getUTCFullYear()!==year) return null;
  return `${yearText}-${monthText}-${dayText}`;
}
function Admin({state,updateMatch,updateTeam,reset,setState,storageWarning}:{state:TournamentState;updateMatch:(id:string,patch:Partial<Match>)=>void;updateTeam:(id:string,patch:Partial<Team>)=>void;reset:()=>void;setState:Dispatch<SetStateAction<TournamentState>>;storageWarning:string}) {
  const [tab,setTab]=useState<AdminTab>('matches');
  const [notice,setNotice]=useState('');
  const [playerMatch,setPlayerMatch]=useState('m5');
  const [askReset,setAskReset]=useState(false);
  const [mapDrafts,setMapDrafts]=useState<Record<string,string>>(()=>Object.fromEntries(state.matches.map(match=>[match.id,mapText(match)])));
  const [mapErrors,setMapErrors]=useState<Record<string,string>>({});
  const [statusErrors,setStatusErrors]=useState<Record<string,string>>({});
  const [dateDrafts,setDateDrafts]=useState<Record<string,string>>(()=>Object.fromEntries(state.matches.map(match=>[match.id,formatDateInput(match.date)])));
  const [dateErrors,setDateErrors]=useState<Record<string,string>>({});
  const [timeDrafts,setTimeDrafts]=useState<Record<string,string>>(()=>Object.fromEntries(state.matches.map(match=>[match.id,match.time])));
  const [timeErrors,setTimeErrors]=useState<Record<string,string>>({});
  const notify=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(''),2600)};
  const playerTarget=state.matches.find(match=>match.id===playerMatch)??state.matches[0];
  const updatePlayer=(index:number,patch:Partial<PlayerStat>)=>setState(current=>({...current,matches:current.matches.map(match=>match.id===playerMatch?{...match,players:match.players.map((player,i)=>i===index?{...player,...patch}:player)}:match)}));
  const changeMatchStatus=(match:Match,status:MatchStatus)=>{
    setStatusErrors(current=>({...current,[match.id]:''}));
    if(status==='Завершён'){
      const value=mapDrafts[match.id]??mapText(match);
      if(!isValidMapScoreText(value,match.round)){
        setMapErrors(current=>({...current,[match.id]:'Проверь формат счёта карт перед завершением матча.'}));
        return;
      }
      const maps=parseMaps(value);
      const pair=resolveMatch(state,match);
      if(!pair.a||!pair.b){
        setStatusErrors(current=>({...current,[match.id]:'Сначала укажи обе команды матча.'}));
        return;
      }
      if(!hasSeriesWinner(maps,match.round)){
        setStatusErrors(current=>({...current,[match.id]:`Для завершения нужна победа в ${match.round==='final'?3:2} картах.`}));
        return;
      }
      setMapErrors(current=>({...current,[match.id]:''}));
      updateMatch(match.id,{maps,status});
      return;
    }
    updateMatch(match.id,{status});
  };
  const commitMaps=(match:Match)=>{
    const value=mapDrafts[match.id]??mapText(match);
    const maps=parseMaps(value);
    if(!isValidMapScoreText(value,match.round)){
      setMapErrors(current=>({...current,[match.id]:'Проверь формат: например, 13-8@Mirage, 13-10@Ancient.'}));
      return;
    }
    if(match.status==='Завершён'&&!hasSeriesWinner(maps,match.round)){
      setMapErrors(current=>({...current,[match.id]:`Для завершения матча нужна победа в ${match.round==='final'?3:2} картах.`}));
      return;
    }
    setMapErrors(current=>({...current,[match.id]:''}));
    updateMatch(match.id,{maps});
  };
  const resetDemo=()=>{
    reset();
    setMapDrafts(Object.fromEntries(initialState.matches.map(match=>[match.id,mapText(match)])));
    setDateDrafts(Object.fromEntries(initialState.matches.map(match=>[match.id,formatDateInput(match.date)])));
    setTimeDrafts(Object.fromEntries(initialState.matches.map(match=>[match.id,match.time])));
    setMapErrors({});
    setStatusErrors({});
    setDateErrors({});
    setTimeErrors({});
    setAskReset(false);
    notify('Демо-данные восстановлены.');
  };
  const rounds:RoundKey[]=['r16','qf','sf','third','final'];
  return <main className="page-wrap">
    <div className="admin-title"><div><div className="eyebrow">Локальная панель управления</div><h1>Контроль<br/><span style={{color:'#f2762c'}}>турнира.</span></h1><p className="hero-sub">Редактируй расписание и результаты демонстрационного турнира.</p></div><div style={{maxWidth:320}}><DemoNotice storageWarning={storageWarning}/></div></div>
    <div className="admin-grid">
      <nav className="admin-tabs" aria-label="Разделы управления">
        <button className={`admin-tab ${tab==='matches'?'active':''}`} onClick={()=>setTab('matches')} data-testid="admin-tab-matches"><Swords size={15}/>Матчи и результаты</button>
        <button className={`admin-tab ${tab==='teams'?'active':''}`} onClick={()=>setTab('teams')} data-testid="admin-tab-teams"><Shield size={15}/>Команды</button>
        <button className={`admin-tab ${tab==='players'?'active':''}`} onClick={()=>setTab('players')} data-testid="admin-tab-players"><Users size={15}/>Статистика игроков</button>
          <div className="panel" style={{marginTop:14}}><div className="panel-body"><div className="eyebrow">Хранилище</div><p style={{fontSize:10,color:'#a7a9ad',lineHeight:1.6}}>Изменения сохраняются автоматически в localStorage этого браузера. Серверной базы данных нет.</p><button className="soft-btn" onClick={()=>setAskReset(true)} data-testid="button-reset-demo"><ArrowDownToLine size={12}/> Сбросить демо</button></div></div>
      </nav>
      <section>
        {notice&&<div className="demo-note" style={{marginBottom:12}} role="status" data-testid="status-admin-save"><Save size={14}/>{notice}</div>}
        {tab==='matches'&&<div className="admin-card"><h3>Матчи и результаты <span className="eyebrow">· {state.matches.length} встреч</span></h3>
          <div className="demo-note" style={{marginBottom:15}}><CircleHelp size={15}/><span>Счёт карт вводится как <b>13-8@Mirage, 13-10@Ancient</b>. При статусе «Завершён» победитель автоматически проходит дальше; проигравшие полуфиналов попадают в матч за третье место.</span></div>
          {rounds.map(round=><div key={round}><div className="eyebrow" style={{margin:'17px 0 5px'}}>{roundNames[round]}</div>{state.matches.filter(match=>match.round===round).map(match=>{
            const pair=resolveMatch(state,match);
            return <div className="admin-match-editor" key={match.id} data-testid={`admin-row-match-${match.id}`}>
              <div className="admin-match-row">
                <div className="admin-match-name">{pair.a?.name??'Победитель пары'} — {pair.b?.name??'Победитель пары'}<small>Матч {match.number} · {scoreLabel(match)}</small></div>
                <input className="compact-input" type="text" inputMode="numeric" value={dateDrafts[match.id]??formatDateInput(match.date)} placeholder="ДД.ММ.ГГГГ" aria-label={`Дата матча ${match.id}, формат ДД.ММ.ГГГГ`} aria-invalid={Boolean(dateErrors[match.id])} onChange={event=>{setDateDrafts(current=>({...current,[match.id]:event.target.value}));setDateErrors(current=>({...current,[match.id]:''}));}} onBlur={()=>{const date=parseDateInput(dateDrafts[match.id]??formatDateInput(match.date));if(date)updateMatch(match.id,{date});else setDateErrors(current=>({...current,[match.id]:'Введи дату в формате ДД.ММ.ГГГГ.'}));}} data-testid={`input-date-${match.id}`}/>
                <input className="compact-input" type="text" inputMode="numeric" value={timeDrafts[match.id]??match.time} placeholder="ЧЧ:ММ" aria-label={`Время матча ${match.id}, формат ЧЧ:ММ`} aria-invalid={Boolean(timeErrors[match.id])} onChange={event=>{setTimeDrafts(current=>({...current,[match.id]:event.target.value}));setTimeErrors(current=>({...current,[match.id]:''}));}} onBlur={()=>{const time=timeDrafts[match.id]??match.time;if(/^([01]\d|2[0-3]):[0-5]\d$/.test(time))updateMatch(match.id,{time});else setTimeErrors(current=>({...current,[match.id]:'Введи время в формате ЧЧ:ММ.'}));}} data-testid={`input-time-${match.id}`}/>
                <select className="status-select" value={match.status} onChange={event=>changeMatchStatus(match,event.target.value as MatchStatus)} aria-label={`Статус матча ${match.id}`} data-testid={`select-status-${match.id}`}><option>Скоро</option><option>LIVE</option><option>Завершён</option></select>
                <input className="compact-input" style={{gridColumn:'1 / 3'}} value={mapDrafts[match.id]??mapText(match)} placeholder="13-8@Mirage, 13-10@Ancient" aria-label={`Счёт карт ${match.id}`} aria-invalid={Boolean(mapErrors[match.id])} onChange={event=>{setMapDrafts(current=>({...current,[match.id]:event.target.value}));setMapErrors(current=>({...current,[match.id]:''}));setStatusErrors(current=>({...current,[match.id]:''}));}} onBlur={()=>commitMaps(match)} onKeyDown={event=>event.key==='Enter'&&event.currentTarget.blur()} data-testid={`input-score-${match.id}`}/>
                <input className="compact-input" value={match.currentMap} placeholder="Текущая карта" aria-label={`Текущая карта ${match.id}`} onChange={event=>updateMatch(match.id,{currentMap:event.target.value})} data-testid={`input-current-map-${match.id}`}/>
                <input className="compact-input" value={match.currentRound} placeholder="Раунд (19:12)" aria-label={`Текущий раунд ${match.id}`} onChange={event=>updateMatch(match.id,{currentRound:event.target.value})} data-testid={`input-current-round-${match.id}`}/>
                <input className="compact-input" style={{gridColumn:'1 / 3'}} type="url" value={match.twitch??''} placeholder="Ссылка на канал Twitch (необязательно)" aria-label={`Twitch ${match.id}`} onChange={event=>updateMatch(match.id,{twitch:event.target.value})} data-testid={`input-twitch-${match.id}`}/>
              </div>
              {dateErrors[match.id]&&<div className="field-error" role="alert" data-testid={`error-date-${match.id}`}>{dateErrors[match.id]}</div>}
              {timeErrors[match.id]&&<div className="field-error" role="alert" data-testid={`error-time-${match.id}`}>{timeErrors[match.id]}</div>}
              {mapErrors[match.id]&&<div className="field-error" role="alert" data-testid={`error-score-${match.id}`}>{mapErrors[match.id]}</div>}
              {statusErrors[match.id]&&<div className="field-error" role="alert" data-testid={`error-status-${match.id}`}>{statusErrors[match.id]}</div>}
              {match.twitch&&!isTwitchUrl(match.twitch)&&<div className="field-error" role="alert" data-testid={`error-twitch-${match.id}`}>Укажи ссылку вида https://www.twitch.tv/название-канала.</div>}
            </div>;
          })}</div>)}
          <p style={{fontSize:9,color:'#848890',marginTop:14}}>Каждое поле сохраняется автоматически. Изменения сразу видны в публичной сетке.</p>
        </div>}
        {tab==='teams'&&<div className="admin-card"><h3>Состав участников <span className="eyebrow">· 16 команд</span></h3>
          {state.teams.map(team=><div className="admin-team-row" key={team.id} data-testid={`admin-team-${team.id}`}><TeamMark team={team}/><div className="field"><label htmlFor={`team-name-${team.id}`}>Название команды</label><input id={`team-name-${team.id}`} value={team.name} onChange={event=>updateTeam(team.id,{name:event.target.value})} data-testid={`input-team-name-${team.id}`}/></div><div className="field"><label htmlFor={`team-school-${team.id}`}>Школа</label><input id={`team-school-${team.id}`} value={team.school} onChange={event=>updateTeam(team.id,{school:event.target.value})} data-testid={`input-team-school-${team.id}`}/></div><div className="field"><label htmlFor={`team-short-${team.id}`}>Эмблема · текст</label><input id={`team-short-${team.id}`} value={team.short} maxLength={4} onChange={event=>updateTeam(team.id,{short:event.target.value.toUpperCase()})} data-testid={`input-team-mark-${team.id}`}/></div><div className="field"><label htmlFor={`team-color-${team.id}`}>Цвет эмблемы</label><div className="team-color-field"><input type="color" id={`team-color-${team.id}`} value={team.color} onChange={event=>updateTeam(team.id,{color:event.target.value})} aria-label={`Цвет эмблемы команды ${team.name}`} data-testid={`input-team-color-${team.id}`}/><span>{team.color}</span></div></div></div>)}
          <p style={{fontSize:9,color:'#848890',marginTop:12}}>Название, школа и эмблема участников сохраняются автоматически и отображаются в сетке.</p>
        </div>}
        {tab==='players'&&<div className="admin-card"><h3>Статистика игроков</h3><div className="field" style={{maxWidth:360,marginBottom:15}}><label htmlFor="stats-match">Выбери матч</label><select id="stats-match" value={playerMatch} onChange={event=>setPlayerMatch(event.target.value)} data-testid="select-player-match">{state.matches.map(match=>{const pair=resolveMatch(state,match);return <option key={match.id} value={match.id}>{pair.a?.name??'Участник'} — {pair.b?.name??'Участник'} · {roundNames[match.round]}</option>})}</select></div>
          <div className="demo-note" style={{marginBottom:15}}><Users size={15}/><span>Добавляй строки игрокам матча. Уб. — убийства, См. — смерти, Пом. — помощи, HS — попадания в голову.</span></div>
          {playerTarget?.players.map((player,index)=><div className="admin-match-row" key={`${player.name}-${index}`} style={{gridTemplateColumns:'minmax(95px,1.2fr) repeat(6,minmax(42px,.55fr))'}} data-testid={`admin-player-${playerMatch}-${index}`}>
            <input className="compact-input" value={player.name} aria-label="Ник игрока" onChange={event=>updatePlayer(index,{name:event.target.value})} data-testid={`input-player-name-${index}`}/>
            <select className="status-select" aria-label="Команда игрока" value={player.teamId} onChange={event=>updatePlayer(index,{teamId:event.target.value})} data-testid={`select-player-team-${index}`}>{state.teams.map(team=><option value={team.id} key={team.id}>{team.short}</option>)}</select>
            {(['kills','deaths','assists','adr','hs','mvp'] as const).map(key=><input key={key} className="compact-input" type="number" min="0" value={player[key]} title={{kills:'Убийства',deaths:'Смерти',assists:'Помощи',adr:'ADR',hs:'Попадания в голову',mvp:'MVP'}[key]} aria-label={`${key} игрока ${player.name}`} onChange={event=>updatePlayer(index,{[key]:Number(event.target.value)})} data-testid={`input-player-${key}-${index}`}/>)}
          </div>)}
          <div className="toolbar" style={{marginTop:14}}><button className="soft-btn" onClick={()=>{setState(current=>({...current,matches:current.matches.map(match=>match.id===playerMatch?{...match,players:[...match.players,{name:'Новый игрок',teamId:resolveMatch(current,match).a?.id??current.teams[0].id,kills:0,deaths:0,assists:0,adr:0,hs:0,mvp:0}]}:match)}));notify('Строка игрока добавлена.')}} data-testid="button-add-player"><Users size={13}/>Добавить игрока</button>
          <button className="soft-btn" onClick={()=>{setState(current=>({...current,matches:current.matches.map(match=>match.id===playerMatch?{...match,players:match.players.slice(0,-1)}:match)}));notify('Последняя строка игрока удалена.')}} data-testid="button-remove-player">Удалить последнюю строку</button></div>
          {!playerTarget?.players.length&&<div className="empty-state">Для этой встречи статистика ещё не добавлена.</div>}
          <div className="eyebrow" style={{marginTop:18}}>Все значения сохраняются в этом браузере</div>
        </div>}
      </section>
    </div>
    {askReset&&<div className="modal-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setAskReset(false)}><section className="modal" role="alertdialog" aria-modal="true"><div className="modal-head"><div><div className="eyebrow">Локальные данные</div><h2>Сбросить демо-турнир?</h2></div><button className="icon-btn" onClick={()=>setAskReset(false)} aria-label="Закрыть"><X size={16}/></button></div><div className="modal-body"><p style={{color:'#a8abb0',fontSize:12}}>Все изменения в этом браузере будут заменены исходным набором демонстрационных данных.</p><div className="modal-actions"><button className="soft-btn" onClick={()=>setAskReset(false)} data-testid="button-cancel-reset">Оставить как есть</button><button className="primary-btn" onClick={resetDemo} data-testid="button-confirm-reset">Сбросить данные</button></div></div></section></div>}
  </main>;
}

function NotFoundPage() { return <main className="page-wrap"><div className="error-state"><AlertTriangle size={24}/><h1>Страница не найдена</h1><Link href="/" className="primary-btn">К турниру</Link></div></main>; }
function AppShell({children,admin=false}:{children:ReactNode;admin?:boolean}) {
  return <div className="app-shell dark"><Header admin={admin}/>{children}<footer style={{borderTop:'1px solid #282b31',padding:'18px clamp(16px,4vw,62px)',color:'#777b83',font:'500 9px IBM Plex Mono,monospace',display:'flex',justifyContent:'space-between',gap:10}}><span>ШКОЛЬНЫЙ КУБОК CS2 · ДЕМО-СЕЗОН 2026</span><span>Локальные демонстрационные данные</span></footer></div>;
}
function Router() {
  const [location]=useLocation();
  const tournament=useTournament();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/"><AppShell><Home state={tournament.state} storageWarning={tournament.storageWarning}/></AppShell></Route>
    <Route path="/admin"><AppShell admin><Admin {...tournament}/></AppShell></Route>
    <Route><AppShell><NotFoundPage/></AppShell></Route>
  </Switch></ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;
