export type MatchStatus = 'Скоро' | 'LIVE' | 'Завершён';
export type RoundKey = 'r16' | 'qf' | 'sf' | 'third' | 'final';

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
}

export interface PlayerStat {
  name: string;
  teamId: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  hs: number;
  mvp: number;
}

export interface MapScore {
  map: string;
  a: number;
  b: number;
}

export interface Match {
  id: string;
  round: RoundKey;
  number: number;
  status: MatchStatus;
  date: string;
  time: string;
  teamA?: string;
  teamB?: string;
  fromA?: { matchId: string; result: 'winner' | 'loser' };
  fromB?: { matchId: string; result: 'winner' | 'loser' };
  maps: MapScore[];
  currentMap: string;
  currentRound: string;
  twitch?: string;
  players: PlayerStat[];
}

export interface TournamentState {
  teams: Team[];
  matches: Match[];
}

export const STORAGE_KEY = 'school-cup-cs2-demo-v3';
export const LEGACY_STORAGE_KEY = 'school-cup-cs2-demo-v2';

export function scheduledMatchDate(round: RoundKey, number: number): string {
  if (round === 'r16') return `2026-10-${number <= 4 ? '26' : '27'}`;
  if (round === 'qf') return `2026-10-${number <= 2 ? '28' : '29'}`;
  if (round === 'sf') return '2026-10-30';
  return '2026-10-31';
}

export function migrateLegacyState(state: TournamentState): TournamentState {
  return {
    teams: state.teams.map(({ id, name, short, color }) => ({ id, name, short, color })),
    matches: state.matches.map(match => ({
      ...match,
      date: scheduledMatchDate(match.round, match.number),
    })),
  };
}

export const initialState: TournamentState = {
  teams: [
    ['north','Северный ветер','СВ','#73a9c6'],
    ['pixel','Пиксельный шторм','ПШ','#c47cd0'],
    ['orbit','Орбита','ОРБ','#7a9ee2'],
    ['voltage','Вольтаж','ВЛТ','#e9b35c'],
    ['frost','Крио','КРИ','#7dc3c0'],
    ['raven','Чёрный ворон','ЧВ','#b88a78'],
    ['nova','Нова','НОВ','#d47773'],
    ['vector','Вектор','ВЕК','#83a476'],
    ['echo','Эхо улиц','ЭХО','#c59663'],
    ['tactic','Тихий пик','ТПК','#8895bd'],
    ['monolith','Монолит','МНЛ','#b0a172'],
    ['spark','Искра','ИСК','#d98b55'],
    ['cipher','Шифр','ШФР','#78a2a0'],
    ['wildcard','Дикий слот','ДСЛ','#b68cc6'],
    ['anchor','Якорь','ЯКР','#a5ad77'],
    ['lowkey','На чиле','НЧЛ','#8b9da4'],
  ].map(([id,name,short,color]) => ({id,name,short,color})),
  matches: [
    {id:'m1',round:'r16',number:1,status:'Завершён',date:'2026-10-26',time:'10:00',teamA:'north',teamB:'pixel',maps:[{map:'Ancient',a:13,b:8},{map:'Mirage',a:13,b:10}],currentMap:'',currentRound:'',players:[]},
    {id:'m2',round:'r16',number:2,status:'Завершён',date:'2026-10-26',time:'10:00',teamA:'orbit',teamB:'voltage',maps:[{map:'Inferno',a:11,b:13},{map:'Anubis',a:13,b:9},{map:'Nuke',a:13,b:7}],currentMap:'',currentRound:'',players:[]},
    {id:'m3',round:'r16',number:3,status:'Завершён',date:'2026-10-26',time:'11:30',teamA:'frost',teamB:'raven',maps:[{map:'Dust2',a:13,b:6},{map:'Mirage',a:13,b:11}],currentMap:'',currentRound:'',players:[]},
    {id:'m4',round:'r16',number:4,status:'Завершён',date:'2026-10-26',time:'11:30',teamA:'nova',teamB:'vector',maps:[{map:'Nuke',a:13,b:10},{map:'Ancient',a:9,b:13},{map:'Inferno',a:8,b:13}],currentMap:'',currentRound:'',players:[]},
    {id:'m5',round:'r16',number:5,status:'LIVE',date:'2026-10-27',time:'13:00',teamA:'echo',teamB:'tactic',maps:[{map:'Mirage',a:13,b:9},{map:'Ancient',a:7,b:10}],currentMap:'Ancient',currentRound:'19:12',twitch:'https://www.twitch.tv/',players:[
      {name:'k0t',teamId:'echo',kills:38,deaths:30,assists:9,adr:86,hs:18,mvp:3},
      {name:'quiet',teamId:'tactic',kills:31,deaths:34,assists:12,adr:74,hs:14,mvp:1},
      {name:'vexa',teamId:'echo',kills:29,deaths:27,assists:8,adr:72,hs:13,mvp:2},
      {name:'m1r',teamId:'tactic',kills:26,deaths:31,assists:10,adr:68,hs:11,mvp:1},
    ]},
    {id:'m6',round:'r16',number:6,status:'Скоро',date:'2026-10-27',time:'13:00',teamA:'monolith',teamB:'spark',maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m7',round:'r16',number:7,status:'Скоро',date:'2026-10-27',time:'14:30',teamA:'cipher',teamB:'wildcard',maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m8',round:'r16',number:8,status:'Скоро',date:'2026-10-27',time:'14:30',teamA:'anchor',teamB:'lowkey',maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m9',round:'qf',number:1,status:'Скоро',date:'2026-10-28',time:'10:00',fromA:{matchId:'m1',result:'winner'},fromB:{matchId:'m2',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m10',round:'qf',number:2,status:'Скоро',date:'2026-10-28',time:'10:00',fromA:{matchId:'m3',result:'winner'},fromB:{matchId:'m4',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m11',round:'qf',number:3,status:'Скоро',date:'2026-10-29',time:'12:00',fromA:{matchId:'m5',result:'winner'},fromB:{matchId:'m6',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m12',round:'qf',number:4,status:'Скоро',date:'2026-10-29',time:'12:00',fromA:{matchId:'m7',result:'winner'},fromB:{matchId:'m8',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m13',round:'sf',number:1,status:'Скоро',date:'2026-10-30',time:'11:00',fromA:{matchId:'m9',result:'winner'},fromB:{matchId:'m10',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m14',round:'sf',number:2,status:'Скоро',date:'2026-10-30',time:'13:30',fromA:{matchId:'m11',result:'winner'},fromB:{matchId:'m12',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m15',round:'third',number:1,status:'Скоро',date:'2026-10-31',time:'11:00',fromA:{matchId:'m13',result:'loser'},fromB:{matchId:'m14',result:'loser'},maps:[],currentMap:'',currentRound:'',players:[]},
    {id:'m16',round:'final',number:1,status:'Скоро',date:'2026-10-31',time:'14:00',fromA:{matchId:'m13',result:'winner'},fromB:{matchId:'m14',result:'winner'},maps:[],currentMap:'',currentRound:'',players:[]},
  ],
};

export const roundNames: Record<RoundKey,string> = {
  r16:'1/8 финала', qf:'Четвертьфиналы', sf:'Полуфиналы', third:'Матч за 3-е место', final:'Гранд-финал',
};

export function resolveMatch(state: TournamentState, match: Match): {a?:Team;b?:Team;winner?:Team;loser?:Team} {
  const byId = (id?:string) => state.teams.find(team => team.id === id);
  const from = (source?:Match['fromA']) => {
    if (!source) return undefined;
    const prev = state.matches.find(item => item.id === source.matchId);
    if (!prev) return undefined;
    const resolved = resolveMatch(state,prev);
    return source.result === 'winner' ? resolved.winner : resolved.loser;
  };
  const a = match.fromA ? from(match.fromA) : byId(match.teamA);
  const b = match.fromB ? from(match.fromB) : byId(match.teamB);
  const wins = (team:'a'|'b') => match.maps.reduce((total,map) => total + (map[team] > map[team === 'a' ? 'b' : 'a'] ? 1 : 0),0);
  const winsNeeded = match.round === 'final' ? 3 : 2;
  let winner:Team|undefined, loser:Team|undefined;
  if (match.status === 'Завершён' && a && b) {
    if (wins('a') >= winsNeeded) { winner=a; loser=b; }
    else if (wins('b') >= winsNeeded) { winner=b; loser=a; }
  }
  return {a,b,winner,loser};
}

export function scoreLabel(match: Match): string {
  if (!match.maps.length) return '—';
  const a=match.maps.filter(map=>map.a>map.b).length;
  const b=match.maps.filter(map=>map.b>map.a).length;
  return `${a} : ${b}`;
}
