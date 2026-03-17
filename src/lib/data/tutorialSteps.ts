export interface TutorialStep {
  id: string;
  type: 'welcome' | 'action' | 'info' | 'completion';
  title: string;
  description: string;
  targetSelector: string | null;
  targetType: 'dom' | 'svg' | null;
  expectedAction: 'click' | 'contextmenu' | 'any' | null;
  expectedTargetSelector: string | null;
  nextButtonLabel: string;
  showBackButton: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    type: 'welcome',
    title: 'Welcome to the Skill Tree Planner',
    description:
      'Plan your ARC Raiders skill tree before going topside.\n\nThis quick tutorial walks you through the key features. Let\'s go!',
    targetSelector: null,
    targetType: null,
    expectedAction: null,
    expectedTargetSelector: null,
    nextButtonLabel: 'Start Tutorial',
    showBackButton: false,
  },
  {
    id: 'click-node',
    type: 'action',
    title: 'Add a Skill',
    description:
      'Click the highlighted node to add it to your skill tree.\n\nEach click spends one Skill Point.',
    targetSelector: '[data-node-id="cond_1"]',
    targetType: 'svg',
    expectedAction: 'click',
    expectedTargetSelector: '[data-node-id="cond_1"]',
    nextButtonLabel: 'Next',
    showBackButton: false,
  },
  {
    id: 'click-deeper',
    type: 'action',
    title: 'Automatic Path Finding',
    description:
      'Now try clicking this deeper skill.\n\nYou don\'t need to unlock each node along the way. The planner finds the optimal path and fills in the required skills for you!',
    targetSelector: '[data-node-id="cond_3l"]',
    targetType: 'svg',
    expectedAction: 'click',
    expectedTargetSelector: '[data-node-id="cond_3l"]',
    nextButtonLabel: 'Next',
    showBackButton: false,
  },
    {
      id: 'wanted-explained',
      type: 'info',
      title: 'Wanted Skills vs Auto-Filled',
      description:
        'See the difference? The bright nodes with the golden ring are skills YOU chose.\n\nThe dimmer one in between was auto-filled by the optimizer. This is the heart of the planner: pick what you want, and it figures out the cheapest way to get there.',
      targetSelector: '[data-node-id="cond_1"], [data-node-id="cond_2l"], [data-node-id="cond_3l"]',
      targetType: 'svg',
      expectedAction: null,
      expectedTargetSelector: null,
      nextButtonLabel: 'Got it',
      showBackButton: true,
    },
    {
      id: 'right-click',
      type: 'action',
      title: 'Remove a Skill',
      description:
        'Right-click any node with a golden ring to remove it from your skill tree.',
      targetSelector: '.skill-node.wanted',
      targetType: 'svg',
      expectedAction: 'contextmenu',
      expectedTargetSelector: '.skill-node.wanted',
      nextButtonLabel: 'Next',
      showBackButton: false,
    },
    {
      id: 'gates-overview',
      type: 'info',
      title: 'Gated Skills',
      description:
        'Each branch in ARC Raiders has 4 skills that require a minimum Skill Point investment to unlock. You can spot them by the badge numbers: 15 or 36.\n\nThe planner tracks all of this for you.',
      targetSelector: '[data-node-id="cond_4l"], [data-node-id="cond_4r"], [data-node-id="cond_7l"], [data-node-id="cond_7r"], [data-node-id="mob_4l"], [data-node-id="mob_4r"], [data-node-id="mob_7l"], [data-node-id="mob_7r"], [data-node-id="surv_4l"], [data-node-id="surv_4r"], [data-node-id="surv_7l"], [data-node-id="surv_7r"]',
      targetType: 'svg',
      expectedAction: null,
      expectedTargetSelector: null,
      nextButtonLabel: 'Got it',
      showBackButton: true,
    },
    {
      id: 'gates-click',
     type: 'action',
     title: 'Want a Gated Skill',
       description:
         'Click this skill in the Mobility branch.\n\nIt requires points spent in the branch to unlock, and it sits at a junction. Don\'t worry, just pick what you want!',
     targetSelector: '[data-node-id="mob_5c"]',
     targetType: 'svg',
     expectedAction: 'click',
     expectedTargetSelector: '[data-node-id="mob_5c"]',
     nextButtonLabel: 'Next',
     showBackButton: false,
   },
   {
     id: 'gates-explained',
     type: 'info',
     title: 'The Optimizer at Work',
      description:
        'Look at what happened! The optimizer built the full path, calculated the gate filler, and picked a branch.\n\nCheck the cost panel for the full breakdown. You choose, the planner does the math.',
     targetSelector: '[data-node-id^="mob_"].allocated, [data-tutorial-target="cost-section"]',
     targetType: 'dom',
     expectedAction: null,
     expectedTargetSelector: null,
     nextButtonLabel: 'Got it',
     showBackButton: true,
   },
     {
       id: 'branch-explained',
       type: 'info',
       title: 'Branch Selector',
        description:
          'See the L/R buttons? These show up when the optimizer can\'t decide which branch to take on its own.\n\nThis happens when none of your wanted skills point to a specific path, or when both branches cost the same. Just pick whichever you prefer.',
       targetSelector: '.branch-selector',
       targetType: 'svg',
       expectedAction: null,
       expectedTargetSelector: null,
       nextButtonLabel: 'Got it',
       showBackButton: true,
     },
     {
       id: 'panel-intro',
    type: 'info',
    title: 'Build Panel',
      description:
        'This panel tracks your skill tree\'s total cost and remaining budget.\n\nIt updates in real time as you add or remove skills.',
    targetSelector: '[data-tutorial-target="panel"]',
    targetType: 'dom',
    expectedAction: null,
    expectedTargetSelector: null,
    nextButtonLabel: 'Next',
    showBackButton: true,
  },
  {
    id: 'panel-cost',
    type: 'info',
    title: 'Cost Breakdown',
      description:
        'Your cost breaks down into three parts:\n\nSkills you selected, path nodes the planner auto-filled, and any filler points needed to meet branch requirements.',
    targetSelector: '[data-tutorial-target="cost-section"]',
    targetType: 'dom',
    expectedAction: null,
    expectedTargetSelector: null,
    nextButtonLabel: 'Next',
    showBackButton: true,
  },
  {
    id: 'panel-expedition',
    type: 'info',
    title: 'Expedition Bonus',
      description:
        'You earn 76 Skill Points from leveling up.\n\nCompleting an Expedition can grant up to 5 bonus points on your next Raider. Enter your bonus here to see your expanded budget.',
    targetSelector: '[data-tutorial-target="expedition-section"]',
    targetType: 'dom',
    expectedAction: null,
    expectedTargetSelector: null,
    nextButtonLabel: 'Next',
    showBackButton: true,
  },
  {
    id: 'share',
    type: 'info',
    title: 'Share Your Build',
      description:
        'Hit "Share Build" to copy a link with your entire skill tree encoded in the URL.\n\nSend it to friends or bookmark it for later!',
    targetSelector: '[data-tutorial-target="actions-section"]',
    targetType: 'dom',
    expectedAction: null,
    expectedTargetSelector: null,
    nextButtonLabel: 'Next',
    showBackButton: true,
  },
  {
    id: 'completion',
    type: 'completion',
    title: "You're Ready!",
      description:
        'You\'re all set to plan your ARC Raiders skill tree!\n\nYour previous selections have been restored. If you ever need a refresher, click this button to retake the tutorial.',
    targetSelector: '[data-testid="tutorial-relaunch"]',
    targetType: 'dom',
    expectedAction: null,
    expectedTargetSelector: null,
    nextButtonLabel: "Let's Go!",
    showBackButton: false,
  },
];

export const TOTAL_STEPS = TUTORIAL_STEPS.length;
