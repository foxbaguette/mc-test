/** A shield with a planet and its ring: Planetary Defense. */
const PlanetaryDefenseSVG = ({ color = '#f85a29' }: { color?: string }) => (
  <svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 0.5L22.5 4.3V11.8C22.5 18.4 18.1 23.3 12 25.5C5.9 23.3 1.5 18.4 1.5 11.8V4.3L12 0.5ZM12 7.2C9.2 7.2 7 9.4 7 12.2C7 15 9.2 17.2 12 17.2C14.8 17.2 17 15 17 12.2C17 9.4 14.8 7.2 12 7.2ZM4.6 15.6C4 14.6 4.4 13.9 5.9 13.2C6 13.7 6.2 14.2 6.5 14.7C6.1 14.9 5.9 15.1 6 15.3C6.3 15.9 9.5 15.2 13 13.6C16.5 12 19 10.1 18.7 9.5C18.6 9.3 18.2 9.3 17.6 9.4C17.3 8.9 16.9 8.5 16.5 8.1C18.2 7.8 19.3 7.9 19.7 8.6C20.5 10.2 17.3 13.1 13.4 14.9C9.5 16.7 5.4 17.2 4.6 15.6Z"
      fill={color}
    />
  </svg>
)

export default PlanetaryDefenseSVG
