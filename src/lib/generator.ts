import {
  DIFFICULTIES,
  DIFFICULTY_QUOTAS,
  Question,
  TEST_QUESTION_COUNT,
  TOPIC_BUCKETS,
  TOPIC_SHARES,
  TopicBucket,
  isQuestionComplete,
  topicBucket,
} from "./domain";

type Edge = { to: number; reverse: number; capacity: number; originalCapacity: number; cost: number };
type CellRef = { difficultyIndex: number; topicIndex: number; edge: Edge };

export type GeneratedSectional = {
  id: string;
  title: string;
  questions: Question[];
  topicCounts: Record<TopicBucket, number>;
  difficultyCounts: Record<"A" | "B" | "C", number>;
  questionIds: string[];
};

export type GenerationResult = {
  forms: GeneratedSectional[];
  eligibleQuestionCount: number;
  incompleteQuestionCount: number;
  incompleteByDifficulty: Record<string, number>;
  eligibleByDifficulty: Record<string, number>;
  maxForms: number;
  limitingCategory: string;
  topicTargetCounts: Record<TopicBucket, number>;
  topicGeneratedCounts: Record<TopicBucket, number>;
  noSolutionQuestions: number;
};

function addEdge(graph: Edge[][], from: number, to: number, capacity: number, cost: number): Edge {
  const forward: Edge = { to, reverse: graph[to].length, capacity, originalCapacity: capacity, cost };
  const backward: Edge = { to: from, reverse: graph[from].length, capacity: 0, originalCapacity: 0, cost: -cost };
  graph[from].push(forward);
  graph[to].push(backward);
  return forward;
}

function minCostMaxFlow(graph: Edge[][], source: number, sink: number, limit: number): number {
  let flow = 0;
  while (flow < limit) {
    const distance = Array(graph.length).fill(Number.POSITIVE_INFINITY) as number[];
    const previousNode = Array(graph.length).fill(-1) as number[];
    const previousEdge = Array(graph.length).fill(-1) as number[];
    const inQueue = Array(graph.length).fill(false) as boolean[];
    const queue: number[] = [source];
    distance[source] = 0;
    inQueue[source] = true;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const node = queue[cursor];
      inQueue[node] = false;
      for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
        const edge = graph[node][edgeIndex];
        if (edge.capacity <= 0 || distance[edge.to] <= distance[node] + edge.cost) continue;
        distance[edge.to] = distance[node] + edge.cost;
        previousNode[edge.to] = node;
        previousEdge[edge.to] = edgeIndex;
        if (!inQueue[edge.to]) {
          queue.push(edge.to);
          inQueue[edge.to] = true;
        }
      }
    }
    if (previousNode[sink] < 0) break;
    let amount = limit - flow;
    for (let node = sink; node !== source; node = previousNode[node]) {
      amount = Math.min(amount, graph[previousNode[node]][previousEdge[node]].capacity);
    }
    for (let node = sink; node !== source; node = previousNode[node]) {
      const edge = graph[previousNode[node]][previousEdge[node]];
      edge.capacity -= amount;
      graph[node][edge.reverse].capacity += amount;
    }
    flow += amount;
  }
  return flow;
}

function largestRemainder(total: number): Record<TopicBucket, number> {
  const rows = TOPIC_BUCKETS.map((topic) => ({ topic, exact: total * TOPIC_SHARES[topic] }));
  const result = Object.fromEntries(rows.map(({ topic, exact }) => [topic, Math.floor(exact)])) as Record<TopicBucket, number>;
  const remaining = total - Object.values(result).reduce((sum, value) => sum + value, 0);
  rows.sort((left, right) => (right.exact - Math.floor(right.exact)) - (left.exact - Math.floor(left.exact)));
  for (let index = 0; index < remaining; index += 1) result[rows[index].topic] += 1;
  return result;
}

function solveTopicDifficultyMatrix(
  eligible: Question[],
  forms: number,
  targets: Record<TopicBucket, number>,
): Record<"A" | "B" | "C", Record<TopicBucket, number>> {
  const source = 0;
  const difficultyStart = 1;
  const topicStart = difficultyStart + DIFFICULTIES.length;
  const sink = topicStart + TOPIC_BUCKETS.length;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  const supply = forms * TEST_QUESTION_COUNT;
  const supplyByDifficulty = DIFFICULTIES.map((difficulty) => forms * DIFFICULTY_QUOTAS[difficulty]);
  const cellRefs: CellRef[] = [];

  DIFFICULTIES.forEach((difficulty, difficultyIndex) => {
    addEdge(graph, source, difficultyStart + difficultyIndex, supplyByDifficulty[difficultyIndex], 0);
    TOPIC_BUCKETS.forEach((topic, topicIndex) => {
      const capacity = eligible.filter((question) => question.difficulty === difficulty && topicBucket(question) === topic).length;
      const edge = addEdge(graph, difficultyStart + difficultyIndex, topicStart + topicIndex, capacity, 0);
      cellRefs.push({ difficultyIndex, topicIndex, edge });
    });
  });

  TOPIC_BUCKETS.forEach((topic, topicIndex) => {
    const available = eligible.filter((question) => topicBucket(question) === topic).length;
    for (let count = 1; count <= available; count += 1) {
      const target = targets[topic];
      const marginalSquaredError = (count - target) ** 2 - (count - 1 - target) ** 2;
      addEdge(graph, topicStart + topicIndex, sink, 1, Math.round(marginalSquaredError * 100));
    }
  });

  const flow = minCostMaxFlow(graph, source, sink, supply);
  if (flow !== supply) throw new Error(`Could only allocate ${flow} of ${supply} required question slots.`);
  const matrix = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, Object.fromEntries(TOPIC_BUCKETS.map((topic) => [topic, 0]))])) as Record<"A" | "B" | "C", Record<TopicBucket, number>>;
  for (const ref of cellRefs) {
    const difficulty = DIFFICULTIES[ref.difficultyIndex];
    const topic = TOPIC_BUCKETS[ref.topicIndex];
    matrix[difficulty][topic] = ref.edge.originalCapacity - ref.edge.capacity;
  }
  return matrix;
}

function spreadSelect(pool: Question[], count: number): Question[] {
  if (count >= pool.length) return [...pool].sort((left, right) => left.id.localeCompare(right.id));
  const ordered = [...pool].sort((left, right) => {
    if (left.pValue === null && right.pValue !== null) return 1;
    if (left.pValue !== null && right.pValue === null) return -1;
    return (left.pValue ?? 0) - (right.pValue ?? 0) || left.id.localeCompare(right.id);
  });
  const picked: Question[] = [];
  for (let index = 0; index < count; index += 1) {
    const poolIndex = Math.min(ordered.length - 1, Math.floor(((index + 0.5) * ordered.length) / count));
    picked.push(ordered[poolIndex]);
  }
  return picked;
}

function difficultySequence(): ("A" | "B" | "C")[] {
  const remaining = { ...DIFFICULTY_QUOTAS };
  const used = { A: 0, B: 0, C: 0 };
  const sequence: ("A" | "B" | "C")[] = [];
  while (sequence.length < TEST_QUESTION_COUNT) {
    const next = DIFFICULTIES.filter((difficulty) => remaining[difficulty] > 0)
      .sort((left, right) => {
        const nextDeficit = (sequence.length + 1) * (DIFFICULTY_QUOTAS[right] / TEST_QUESTION_COUNT) - used[right];
        const currentDeficit = (sequence.length + 1) * (DIFFICULTY_QUOTAS[left] / TEST_QUESTION_COUNT) - used[left];
        return nextDeficit - currentDeficit || DIFFICULTIES.indexOf(left) - DIFFICULTIES.indexOf(right);
      })[0];
    sequence.push(next);
    remaining[next] -= 1;
    used[next] += 1;
  }
  return sequence;
}

export function generateSectionals(allQuestions: Question[]): GenerationResult {
  const complete = allQuestions.filter((question) => isQuestionComplete(question));
  const incomplete = allQuestions.filter((question) => !isQuestionComplete(question));
  const completeByDifficulty = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, complete.filter((question) => question.difficulty === difficulty).length])) as Record<"A" | "B" | "C", number>;
  const incompleteByDifficulty = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, incomplete.filter((question) => question.difficulty === difficulty).length])) as Record<string, number>;
  const difficultyCaps = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, Math.floor(completeByDifficulty[difficulty] / DIFFICULTY_QUOTAS[difficulty])])) as Record<"A" | "B" | "C", number>;
  const difficultyMax = Math.min(...Object.values(difficultyCaps));
  const totalMax = Math.floor(complete.length / TEST_QUESTION_COUNT);
  const theoreticalMax = Math.min(difficultyMax, totalMax);
  let maxForms = theoreticalMax;
  let targetTopicCounts = largestRemainder(maxForms * TEST_QUESTION_COUNT);
  let matrix: Record<"A" | "B" | "C", Record<TopicBucket, number>> | null = null;
  while (maxForms > 0) {
    targetTopicCounts = largestRemainder(maxForms * TEST_QUESTION_COUNT);
    try {
      matrix = solveTopicDifficultyMatrix(complete, maxForms, targetTopicCounts);
      break;
    } catch {
      maxForms -= 1;
    }
  }
  const limitingCategory = maxForms < theoreticalMax
    ? "Topic and difficulty availability"
    : totalMax < difficultyMax
      ? "Total complete question count"
      : DIFFICULTIES.filter((difficulty) => difficultyCaps[difficulty] === difficultyMax).map((difficulty) => `Type ${difficulty}`).join(" + ");
  const topicGeneratedCounts = Object.fromEntries(TOPIC_BUCKETS.map((topic) => [topic, 0])) as Record<TopicBucket, number>;
  if (maxForms === 0) {
    return {
      forms: [], eligibleQuestionCount: complete.length, incompleteQuestionCount: incomplete.length,
      incompleteByDifficulty, eligibleByDifficulty: completeByDifficulty, maxForms,
      limitingCategory,
      topicTargetCounts: targetTopicCounts, topicGeneratedCounts,
      noSolutionQuestions: allQuestions.filter((question) => !question.hasSolution).length,
    };
  }

  if (!matrix) throw new Error("No topic and difficulty allocation could be created.");
  const forms = Array.from({ length: maxForms }, (_, index) => ({
    id: `sectional-${String(index + 1).padStart(2, "0")}`,
    title: `Sectional ${String(index + 1).padStart(2, "0")}`,
    questions: [] as Question[],
    topicCounts: Object.fromEntries(TOPIC_BUCKETS.map((topic) => [topic, 0])) as Record<TopicBucket, number>,
    difficultyCounts: { A: 0, B: 0, C: 0 },
    questionIds: [] as string[],
  }));

  for (const difficulty of DIFFICULTIES) {
    for (const topic of TOPIC_BUCKETS) {
      const count = matrix[difficulty][topic];
      if (!count) continue;
      const pool = complete.filter((question) => question.difficulty === difficulty && topicBucket(question) === topic);
      const selected = spreadSelect(pool, count);
      const eligibleForms = [...forms];
      selected.forEach((question, itemIndex) => {
        const candidates = eligibleForms.filter((form) => form.difficultyCounts[difficulty] < DIFFICULTY_QUOTAS[difficulty]);
        candidates.sort((left, right) =>
          left.topicCounts[topic] - right.topicCounts[topic] ||
          (left.questions.length % TEST_QUESTION_COUNT) - (right.questions.length % TEST_QUESTION_COUNT) ||
          left.id.localeCompare(right.id),
        );
        const targetForm = candidates[itemIndex % candidates.length];
        targetForm.questions.push(question);
        targetForm.questionIds.push(question.id);
        targetForm.topicCounts[topic] += 1;
        targetForm.difficultyCounts[difficulty] += 1;
        topicGeneratedCounts[topic] += 1;
      });
    }
  }

  const sequence = difficultySequence();
  for (const form of forms) {
    const byDifficulty = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, form.questions.filter((question) => question.difficulty === difficulty)])) as Record<"A" | "B" | "C", Question[]>;
    for (const difficulty of DIFFICULTIES) {
      byDifficulty[difficulty].sort((left, right) =>
        form.topicCounts[topicBucket(left) ?? "Arithmetic"] - form.topicCounts[topicBucket(right) ?? "Arithmetic"] ||
        left.id.localeCompare(right.id),
      );
    }
    const cursors = { A: 0, B: 0, C: 0 };
    form.questions = sequence.map((difficulty) => byDifficulty[difficulty][cursors[difficulty]++]);
  }

  return {
    forms,
    eligibleQuestionCount: complete.length,
    incompleteQuestionCount: incomplete.length,
    incompleteByDifficulty,
    eligibleByDifficulty: completeByDifficulty,
    maxForms,
    limitingCategory,
    topicTargetCounts: targetTopicCounts,
    topicGeneratedCounts,
    noSolutionQuestions: allQuestions.filter((question) => !question.hasSolution).length,
  };
}
