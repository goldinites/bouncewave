import { TutorialCard } from '@/match/tutorial';
import { MenuButton } from '@/ui/screens/MenuButton';

export interface TutorialCardScreenProps {
  card: TutorialCard;
  /** Why the move is worth making, and how to make it. */
  why: string;
  how: string;
  okLabel: string;
  onOk: () => void;
  /** A still frame of the example instead of its loop. */
  isMotionReduced: boolean;
  /**
   * The court is turned on a portrait phone (the learner's paddle at the bottom): the example is
   * turned the same way, so it shows what they see.
   */
  isRotated: boolean;
}

/**
 * A card that opens a tutorial step, the match paused behind it: an example of the move on a
 * small court, why it is worth making and how, and GOT IT to play it.
 */
export function TutorialCardScreen({
  card,
  why,
  how,
  okLabel,
  onOk,
  isMotionReduced,
  isRotated,
}: TutorialCardScreenProps) {
  return (
    <div class="tutorial-card">
      <TutorialDemo card={card} isMotionReduced={isMotionReduced} isRotated={isRotated} />
      <p class="tutorial-card__why">{why}</p>
      <p class="tutorial-card__how">{how}</p>
      <div class="screen-buttons">
        <MenuButton color="yellow" onClick={onOk}>
          {okLabel}
        </MenuButton>
      </div>
    </div>
  );
}

// The example's court, in its own units: walls along the top and bottom, the learner's paddle
// on the left, a ball coming from the right. One loop of the example lasts DURATION seconds
const DEMO = {
  WIDTH: 200,
  HEIGHT: 120,
  WALL: 6,
  PADDLE: { X: 14, WIDTH: 6, HEIGHT: 32 },
  PERFECT_ZONE: 7, // the yellow band's height
  BALL: 4, // radius
  DURATION: 2.6, // s
} as const;
// Where a ball meets the paddle's face
const FACE = DEMO.PADDLE.X + DEMO.PADDLE.WIDTH + DEMO.BALL;

/** One example: the ball's flight, the paddle's moves, and when in the loop they happen. */
interface Example {
  /** The ball's path, SVG path data. */
  path: string;
  /** How far along the path the ball is (0–1) at each of `times` (0–1 of the loop). */
  points: readonly number[];
  times: readonly number[];
  /** The paddle's center at each of `paddleTimes`, its own clock over the loop. */
  paddle: readonly number[];
  paddleTimes: readonly number[];
  /** Where the ball meets the paddle, for the still frame: share of the path, and the paddle there. */
  still: { point: number; paddle: number };
  /** Draws the yellow center (the perfect hit) on the paddle. */
  showsCenter?: boolean;
  /** The paddle's end it meets the ball with lit (the angle). */
  litEnd?: 1 | -1;
  /** An arrow beside the paddle the way it moves as it strikes (the aim). */
  arrow?: 1 | -1;
  /** The meter's charges lighting one by one, at these times; the ball blazes after the last. */
  meter?: readonly number[];
  /** Seconds the loop lasts, when not DURATION. */
  duration?: number;
}

const MID = DEMO.HEIGHT / 2;

const EXAMPLES: Record<TutorialCard, Example> = {
  // Off the lower end it goes off steep, down into the wall and away up the court
  angle: {
    path: `M ${DEMO.WIDTH - 10} 40 L ${FACE} 73 L 64 ${DEMO.HEIGHT - DEMO.WALL - DEMO.BALL} L ${DEMO.WIDTH - 10} 14`,
    points: [0, 0.4, 1],
    times: [0, 0.45, 1],
    paddle: [MID, MID],
    paddleTimes: [0, 1],
    still: { point: 0.4, paddle: MID },
    litEnd: 1,
  },
  // Off the yellow center it comes back faster than it came
  perfect: {
    path: `M ${DEMO.WIDTH - 10} 40 L ${FACE} ${MID} L ${DEMO.WIDTH - 10} ${MID}`,
    points: [0, 0.5, 1],
    times: [0, 0.62, 1],
    paddle: [MID, MID],
    paddleTimes: [0, 1],
    still: { point: 0.5, paddle: MID },
    showsCenter: true,
  },
  // The paddle sweeps up through the ball, center on: it goes off up the court
  aim: {
    path: `M ${DEMO.WIDTH - 10} ${MID} L ${FACE} ${MID} L 120 ${DEMO.WALL + DEMO.BALL} L ${DEMO.WIDTH - 10} 40`,
    points: [0, 0.45, 1],
    times: [0, 0.55, 1],
    paddle: [78, 78, 42, 42],
    paddleTimes: [0, 0.4, 0.7, 1],
    still: { point: 0.45, paddle: MID },
    showsCenter: true,
    arrow: -1,
  },
  // Three perfect hits light the meter; the fourth goes off as a power shot
  overdrive: {
    path: Array.from({ length: 4 }, () => `L ${FACE} ${MID} L ${DEMO.WIDTH - 10} ${MID}`)
      .join(' ')
      .replace(/^L/, `M ${DEMO.WIDTH - 10} ${MID} L`),
    // The power shot's leg is flown in half the time, and the ball waits at its end
    points: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1],
    times: [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 0.9, 1],
    paddle: [MID, MID],
    paddleTimes: [0, 1],
    still: { point: 0.875, paddle: MID },
    showsCenter: true,
    meter: [0.12, 0.36, 0.6],
    duration: 4.4,
  },
};

const list = (values: readonly number[]) => values.join(';');

/** An animateMotion's path, which Preact's SVG types leave out. */
const motionPath = (path: string) => ({ path }) as Record<string, string>;

/** The example's small court: the move made over and over, or its still frame. */
function TutorialDemo({
  card,
  isMotionReduced,
  isRotated,
}: {
  card: TutorialCard;
  isMotionReduced: boolean;
  isRotated: boolean;
}) {
  const example = EXAMPLES[card];
  const duration = `${example.duration ?? DEMO.DURATION}s`;
  const { PADDLE } = DEMO;
  const paddleTop = (center: number) => center - PADDLE.HEIGHT / 2;
  const stillPaddle = example.still.paddle;

  // Things on the paddle ride with it: drawn in its frame and moved with it
  const paddleMove = !isMotionReduced && (
    <animateTransform
      attributeName="transform"
      type="translate"
      values={example.paddle.map((center) => `0 ${center - stillPaddle}`).join(';')}
      keyTimes={list(example.paddleTimes)}
      dur={duration}
      repeatCount="indefinite"
    />
  );

  return (
    <svg
      class={isRotated ? 'tutorial-card__demo tutorial-card__demo--rotated' : 'tutorial-card__demo'}
      viewBox={isRotated ? `0 0 ${DEMO.HEIGHT} ${DEMO.WIDTH}` : `0 0 ${DEMO.WIDTH} ${DEMO.HEIGHT}`}
      role="img"
      aria-hidden="true"
    >
      {/* A quarter turn left, as the court is turned: its left side at the bottom */}
      <g transform={isRotated ? `translate(0 ${DEMO.WIDTH}) rotate(-90)` : undefined}>
        <rect class="tutorial-demo__wall" x="0" y="0" width={DEMO.WIDTH} height={DEMO.WALL} />
        <rect
          class="tutorial-demo__wall"
          x="0"
          y={DEMO.HEIGHT - DEMO.WALL}
          width={DEMO.WIDTH}
          height={DEMO.WALL}
        />
        <path class="tutorial-demo__path" d={example.path} />

        <g>
          {paddleMove}
          <rect
            class="tutorial-demo__paddle"
            x={PADDLE.X}
            y={paddleTop(stillPaddle)}
            width={PADDLE.WIDTH}
            height={PADDLE.HEIGHT}
            rx="3"
          />
          {example.showsCenter && (
            <rect
              class="tutorial-demo__center"
              x={PADDLE.X - 2}
              y={stillPaddle - DEMO.PERFECT_ZONE / 2}
              width={PADDLE.WIDTH + 4}
              height={DEMO.PERFECT_ZONE}
              rx="2"
            />
          )}
          {example.litEnd && (
            <rect
              class="tutorial-demo__end"
              x={PADDLE.X - 2}
              y={
                example.litEnd > 0
                  ? stillPaddle + PADDLE.HEIGHT / 2 - 9
                  : stillPaddle - PADDLE.HEIGHT / 2
              }
              width={PADDLE.WIDTH + 4}
              height="9"
              rx="2"
            />
          )}
          {example.arrow && (
            <path
              class="tutorial-demo__arrow"
              d={
                example.arrow < 0
                  ? `M 6 ${stillPaddle + 8} L 6 ${stillPaddle - 10} M 2 ${stillPaddle - 5} L 6 ${stillPaddle - 10} L 10 ${stillPaddle - 5}`
                  : `M 6 ${stillPaddle - 8} L 6 ${stillPaddle + 10} M 2 ${stillPaddle + 5} L 6 ${stillPaddle + 10} L 10 ${stillPaddle + 5}`
              }
            />
          )}
        </g>

        {example.meter?.map((at, i) => (
          <rect
            key={i}
            class="tutorial-demo__charge"
            x={PADDLE.X - 8}
            y={MID + 12 - i * 10}
            width="3"
            height="8"
            opacity={isMotionReduced ? 1 : 0.25}
          >
            {!isMotionReduced && (
              <animate
                attributeName="opacity"
                values="0.25;0.25;1;1;0.25"
                keyTimes={list([0, at, at + 0.01, 0.84, 0.85])}
                dur={duration}
                repeatCount="indefinite"
              />
            )}
          </rect>
        ))}

        <circle class="tutorial-demo__ball" r={DEMO.BALL} cx="0" cy="0">
          {isMotionReduced ? (
            <animateMotion
              {...motionPath(example.path)}
              keyPoints={`${example.still.point};${example.still.point}`}
              keyTimes="0;1"
              calcMode="linear"
              dur="1s"
              fill="freeze"
            />
          ) : (
            <animateMotion
              {...motionPath(example.path)}
              keyPoints={list(example.points)}
              keyTimes={list(example.times)}
              calcMode="linear"
              dur={duration}
              repeatCount="indefinite"
            />
          )}
          {example.meter && !isMotionReduced && (
            <animate
              attributeName="fill"
              values="#ffffff;#ffffff;#ffe53b;#ffe53b"
              keyTimes={list([0, 0.84, 0.85, 1])}
              dur={duration}
              repeatCount="indefinite"
            />
          )}
          {example.meter && !isMotionReduced && (
            <animate
              attributeName="r"
              values={list([DEMO.BALL, DEMO.BALL, DEMO.BALL * 1.8, DEMO.BALL * 1.8])}
              keyTimes={list([0, 0.84, 0.85, 1])}
              dur={duration}
              repeatCount="indefinite"
            />
          )}
        </circle>
      </g>
    </svg>
  );
}
