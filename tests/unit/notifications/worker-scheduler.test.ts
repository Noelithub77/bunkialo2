import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
mock.module("cloudflare:workers", () => ({DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} }}));
const pushes: string[] = [];
mock.module("../../../worker/push/send-push", () => ({sendReminderPush: async (input: {reminder:{id:string}}) => { pushes.push(input.reminder.id); return new Response(null,{status:201}); }}));
const {UserSession} = await import("../../../worker/session-object");
let clock = Date.parse("2026-10-02T10:00:00Z");
let alarmAt: number | null = null;
let database: Database;
let session: InstanceType<typeof UserSession>;
let nowMock: ReturnType<typeof spyOn>;
let fetchMock: ReturnType<typeof spyOn>;
let items: {id:string;title:string;body:string;kind:string;createdAt:string;readAt:null}[];
const seed = (key:string,value:unknown) => database.query("INSERT OR REPLACE INTO session_values VALUES (?, ?, ?)").run(key,JSON.stringify(value),clock);
const rowCount = (table:string) => (database.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n:number}).n;
beforeEach(async () => {
 clock=Date.parse("2026-10-02T10:00:00Z"); alarmAt=null;pushes.length=0;items=[];database=new Database(":memory:");
 nowMock=spyOn(Date,"now").mockImplementation(()=>clock);
 fetchMock=spyOn(globalThis,"fetch").mockImplementation(async ()=>Response.json({items,unreadCount:items.length}));
 const storage = {sql: {exec: (query:string,...bindings:(string|number|null)[]) => {
   if(query.includes("CREATE TABLE")) {database.exec(query);return {};}
   const rows=database.query(query).all(...bindings);
   return {toArray:()=>rows,one:()=>rows[0]};
 }},getAlarm:async()=>alarmAt,setAlarm:async(t:number)=>{alarmAt=t;},deleteAlarm:async()=>{alarmAt=null;}};
 const ctx={storage,blockConcurrencyWhile:async(fn:()=>Promise<void>)=>fn()};
 session=new UserSession(ctx as never,{ATTENDANCE_PORTAL_URL:"https://attendance.example",VAPID_PRIVATE_KEY:"fake",VAPID_ADMIN_CONTACT:"mailto:test@example.com"} as never);
 seed("attendance",{accessToken:"fixture",refreshToken:"fixture"});
 await session.savePushSubscription({endpoint:"https://push.example/test",keys:{auth:"fixture",p256dh:"fixture"}});
});
afterEach(()=>{nowMock.mockRestore();fetchMock.mockRestore();database.close();});
describe("web background notification alarms",()=>{
 test("initial baseline stays silent; each new unread alert pushes once, every 15 minutes",async()=>{
   clock+=1000;await session.alarm();expect(pushes).toHaveLength(0);expect(alarmAt).toBe(clock+15*60000);
   items=[{id:"new",title:"Marked absent — CSE311",body:"You were marked absent in Artificial Intelligence on 2026-10-02.",kind:"ATTENDANCE_ABSENT",createdAt:new Date(clock).toISOString(),readAt:null}];
   clock+=15*60000;await session.alarm();clock+=1000;await session.alarm();expect(pushes).toHaveLength(1);
   clock+=15*60000;await session.alarm();expect(pushes).toHaveLength(1);expect(rowCount("session_values")).toBeGreaterThan(0);
 });
 test("an empty early alarm preserves login and future calendar reminders",async()=>{
   await session.scheduleReminder({id:"calendar-fixture",title:"Club event",body:"Starts in 30 min",date:clock+3600000,url:"/acad-cal"});
   clock+=1000;await session.alarm();expect(rowCount("reminders")).toBe(1);expect(await session.listScheduledReminderIds()).toEqual(["calendar-fixture"]);
 });
 test("turning notifications off stops polling and cancels pending reminders",async()=>{
   await session.scheduleReminder({id:"fixture",title:"Event",body:"",date:clock+3600000});await session.setPushEnabled(false);expect(rowCount("reminders")).toBe(0);
   clock+=1000;await session.alarm();expect(fetchMock).not.toHaveBeenCalled();expect(pushes).toHaveLength(0);
 });
 test("logout removes subscriptions and credentials, then stops all alarms",async()=>{await session.logout();expect(await session.hasPushSubscription()).toBe(false);expect(rowCount("session_values")).toBe(0);expect(alarmAt).toBeNull();});
 test("stable reminder IDs retain delivered receipts across retries",async()=>{await session.scheduleReminder({id:"stable",title:"Event",body:"",date:clock});await session.alarm();expect(pushes).toEqual(["stable"]);await session.scheduleReminder({id:"stable",title:"Event",body:"",date:clock});await session.alarm();expect(pushes).toEqual(["stable"]);});
});
