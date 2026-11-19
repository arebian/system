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

test("each of the three daily quest pillars receives only its own three missions", () => {
  const focusedTasks = [
    {id:"d1",title:"D1",pillar:"DISCIPLINE",difficulty:"EASY",duration_minutes:5},
    {id:"d2",title:"D2",pillar:"DISCIPLINE",difficulty:"NORMAL",duration_minutes:10},
    {id:"d3",title:"D3",pillar:"DISCIPLINE",difficulty:"NORMAL",duration_minutes:15},
    {id:"p1",title:"P1",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:5},
    {id:"p2",title:"P2",pillar:"PHYSICAL",difficulty:"NORMAL",duration_minutes:10},
    {id:"p3",title:"P3",pillar:"PHYSICAL",difficulty:"NORMAL",duration_minutes:15},
    {id:"m1",title:"M1",pillar:"MENTAL",difficulty:"EASY",duration_minutes:5},
    {id:"m2",title:"M2",pillar:"MENTAL",difficulty:"NORMAL",duration_minutes:10},
    {id:"m3",title:"M3",pillar:"MENTAL",difficulty:"NORMAL",duration_minutes:15},
    {id:"w1",title:"W1",pillar:"WEALTH",difficulty:"NORMAL",duration_minutes:10},
  ];

  for (const pillar of ["DISCIPLINE", "PHYSICAL", "MENTAL"]) {
    const result = recommendQuestObjectives(focusedTasks, {primary:"WEALTH"}, {level:1}, 3, pillar);
    assert.equal(result.length, 3, pillar + " should receive exactly three missions");
    assert.ok(result.every(item => item.pillar === pillar), pillar + " must not receive another pillar's tasks");
  }
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

test("recommendations can include timer objectives now that server verification exists", () => {
  const result = recommendQuestObjectives([
    {id:"timer",title:"FOCUS TIMER",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:10,proof_type:"TIMER"},
    {id:"note",title:"MOVE",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:10,proof_type:"HONOR"},
    {id:"read",title:"READ",pillar:"INTELLECT",difficulty:"NORMAL",duration_minutes:15,proof_type:"NOTE"},
    {id:"wealth",title:"BUILD",pillar:"WEALTH",difficulty:"NORMAL",duration_minutes:20,proof_type:"NOTE"},
  ],{primary:"WEALTH"},{level:1},3);
  assert.equal(result.length,3);
  assert.ok(result.some(item => item.proof_type === "TIMER"));
  assert.equal(new Set(result.map(item => item.pillar)).size,3);
});

test("daily pillar recommendations exclude tasks above the player's level", () => {
  const levelOneTasks = [
    {id:"easy-1",title:"EASY ONE",pillar:"PHYSICAL",difficulty:"EASY",duration_minutes:5,min_level:1,proof_type:"NOTE"},
    {id:"easy-2",title:"EASY TWO",pillar:"PHYSICAL",difficulty:"NORMAL",duration_minutes:10,min_level:1,proof_type:"NOTE"},
    {id:"easy-3",title:"EASY THREE",pillar:"PHYSICAL",difficulty:"NORMAL",duration_minutes:15,min_level:1,proof_type:"NOTE"},
    {id:"locked-1",title:"LOCKED ONE",pillar:"PHYSICAL",difficulty:"HARD",duration_minutes:5,min_level:2,proof_type:"NOTE"},
    {id:"locked-2",title:"LOCKED TWO",pillar:"PHYSICAL",difficulty:"ELITE",duration_minutes:5,min_level:3,proof_type:"NOTE"},
  ];
  const result = recommendQuestObjectives(levelOneTasks,{primary:"DISCIPLINE"},{level:1,recentCompletionRate:95},3,"PHYSICAL");
  assert.deepEqual(result.map(item=>item.id),["easy-1","easy-2","easy-3"]);
  assert.ok(result.every(item=>item.min_level <= 1));
});

test("higher-level players can receive tasks unlocked for their level", () => {
  const levelTwoTasks = [
    {id:"base",title:"BASE",pillar:"MENTAL",difficulty:"EASY",duration_minutes:5,min_level:1,proof_type:"NOTE"},
    {id:"advanced",title:"ADVANCED",pillar:"MENTAL",difficulty:"HARD",duration_minutes:10,min_level:2,proof_type:"NOTE"},
    {id:"locked",title:"LOCKED",pillar:"MENTAL",difficulty:"ELITE",duration_minutes:10,min_level:3,proof_type:"NOTE"},
  ];
  const result = recommendQuestObjectives(levelTwoTasks,{primary:"DISCIPLINE"},{level:2,recentCompletionRate:95},3,"MENTAL");
  assert.ok(result.some(item=>item.id === "advanced"));
  assert.ok(result.every(item=>item.min_level <= 2));
});
