const MembershipSVG = ({ color = 'white' }: { color: string }) => {
  return (
    <svg width="27" height="27" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_16_440)">
        <path
          d="M22.5 2.25H4.5C3.25688 2.25 2.25 3.25688 2.25 4.5V16.875C2.25 18.1181 3.25688 19.125 4.5 19.125H9V24.75L13.5 22.5L18 24.75V19.125H22.5C23.7431 19.125 24.75 18.1181 24.75 16.875V4.5C24.75 3.25688 23.7431 2.25 22.5 2.25ZM22.5 16.875H4.5V14.625H22.5V16.875ZM22.5 11.25H4.5V4.5H22.5V11.25Z"
          fill={color}
        />
      </g>
      <defs>
        <clipPath id="clip0_16_440">
          <rect width="27" height="27" fill={color} />
        </clipPath>
      </defs>
    </svg>
  )
}

export default MembershipSVG
