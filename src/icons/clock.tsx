
const ClockSVG = () => {
  return (
    <svg
      className="clock-svg"
      width="43"
      height="43"
      viewBox="0 0 43 43"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="Frame">
        <path
          id="Vector"
          d="M21.5002 39.4163C31.3953 39.4163 39.4168 31.3948 39.4168 21.4997C39.4168 11.6046 31.3953 3.58301 21.5002 3.58301C11.6051 3.58301 3.5835 11.6046 3.5835 21.4997C3.5835 31.3948 11.6051 39.4163 21.5002 39.4163Z"
          stroke="url(#paint0_linear_114_1082)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          id="Vector_2"
          d="M21.5 10.75V21.5L28.6667 25.0833"
          stroke="url(#paint1_linear_114_1082)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_114_1082"
          x1="21.5002"
          y1="3.58301"
          x2="21.5002"
          y2="39.4163"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00E677" />
          <stop offset="1" stopColor="#00793F" />
        </linearGradient>
        <linearGradient
          id="paint1_linear_114_1082"
          x1="25.0833"
          y1="10.75"
          x2="25.0833"
          y2="25.0833"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#00E677" />
          <stop offset="1" stopColor="#00793F" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default ClockSVG
