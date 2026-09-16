
const GradientBorder = ({
  color1 = '#FF1FCE',
  color2 = '#00A3FF78'
}: {
  color1?: string
  color2?: string
}) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="Gradient" x1="0" x2="100" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor={color1} offset="0" />
          <stop stopColor={color2} offset="1" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        height="100%"
        width="100%"
        style={{
          width: `calc(100% - 3px)`,
          height: `calc(100% - 3px)`
        }}
        rx="15"
        ry="15"
        strokeWidth="3"
        fill="transparent"
        stroke="url(#Gradient)"
      />
    </svg>
  )
}

export default GradientBorder
