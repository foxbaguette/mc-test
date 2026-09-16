
const TutorialSVG = ({ color = 'white' }: { color: string }) => {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g id="Frame" clipPath="url(#clip0_433_64)">
        <path
          id="Vector"
          d="M5.994 14.4L18 21.6L36 10.8L18 0L0 10.8H18V14.4H5.994ZM0 14.4V28.8L3.6 24.804V16.56L0 14.4ZM18 36L9 30.6L5.4 28.44V17.64L18 25.2L30.6 17.64V28.44L18 36Z"
          fill={color}
        />
      </g>
      <defs>
        <clipPath id="clip0_433_64">
          <rect width="36" height="36" fill={color} />
        </clipPath>
      </defs>
    </svg>
  )
}

export default TutorialSVG
