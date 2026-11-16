import test from "node:test";
import assert from "node:assert/strict";
import { recommendQuestObjectives, objectiveProposalSummary } from "../src/systemQuestObjectivesCore.js";

const tasks = [
  {id:"p",title:"MOVE",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:10},
  {id:"i",title:"READ",pillar:"INTELLECT",difficulty:"NORMAL",duration_minutes:15},
  {id:"w",title:"BUILD",pillar:"WEALTH",difficulty:"NORMAL",duration_minutes:20},
  {id:"d",title:"PLAN",pillar:"DISCIPLINE",difficulty:"EASY",duration_minutes:5},
];

test("No Zero Day recommendations include physical, intellect and primary identity", () => {
  const result = recommendQuestObjectives(tasks,{primary:"WEALTH",secondary:["DISCIPLINE"]},{level:1},3);
  assert.deepEqual(result.map(item=>item.pillar),["PHYSICAL","INTELLECT","WEALTH"]);
});

test("recommendations never repeat a pillar", () => {
  const result = recommendQuestObjectives(tasks,{primary:"PHYSICAL",secondary:["INTELLECT"]},{level:1},3);
  assert.equal(new Set(result.map(item=>item.pillar)).size,result.length);
});

test("adaptive difficulty favours manageable tasks when completion rate is low", () => {
  const result = recommendQuestObjectives(tasks,{primary:"WEALTH"},{level:1,recentCompletionRate:20},3);
  assert.equal(result[0].difficulty,"EASY");
});

test("proposal summary reports acceptance state", () => {
  assert.deepEqual(objectiveProposalSummary([
    {status:"ACCEPTED"},{status:"PROPOSED"},{status:"COMPLETED"}
  ]),{total:3,accepted:1,proposed:1,completed:1,allAccepted:false});
});

test("recommendations skip timer-only tasks until objective timers are integrated", () => {
  const result = recommendQuestObjectives([
    {id:"timer",title:"FOCUS TIMER",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:10,proof_type:"TIMER"},
    {id:"note",title:"MOVE",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:10,proof_type:"HONOR"},
    {id:"read",title:"READ",pillar:"INTELLECT",difficulty:"NORMAL",duration_minutes:15,proof_type:"NOTE"},
    {id:"wealth",title:"BUILD",pillar:"WEALTH",difficulty:"NORMAL",duration_minutes:20,proof_type:"NOTE"},
  ],{primary:"WEALTH"},{level:1},3);
  assert.ok(result.every(item => item.proof_type !== "TIMER"));
  assert.equal(result[0].id,"note");
});
