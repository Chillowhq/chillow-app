interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TimezoneSelect({ value, onChange, className }: TimezoneSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className ?? "w-full p-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium appearance-none"}
    >
      {/* ── Africa ── */}
      <optgroup label="Africa">
        <option value="Africa/Abidjan">UTC+0 — Abidjan (Côte d'Ivoire)</option>
        <option value="Africa/Accra">UTC+0 — Accra (Ghana)</option>
        <option value="Africa/Addis_Ababa">UTC+3 — Addis Ababa (Ethiopia)</option>
        <option value="Africa/Algiers">UTC+1 — Algiers (Algeria)</option>
        <option value="Africa/Cairo">UTC+2 — Cairo (Egypt)</option>
        <option value="Africa/Casablanca">UTC+1 — Casablanca (Morocco)</option>
        <option value="Africa/Dakar">UTC+0 — Dakar (Senegal)</option>
        <option value="Africa/Dar_es_Salaam">UTC+3 — Dar es Salaam (Tanzania)</option>
        <option value="Africa/Douala">UTC+1 — Douala (Cameroon)</option>
        <option value="Africa/Harare">UTC+2 — Harare (Zimbabwe)</option>
        <option value="Africa/Johannesburg">UTC+2 — Johannesburg (South Africa)</option>
        <option value="Africa/Kampala">UTC+3 — Kampala (Uganda)</option>
        <option value="Africa/Khartoum">UTC+3 — Khartoum (Sudan)</option>
        <option value="Africa/Kinshasa">UTC+1 — Kinshasa (DR Congo)</option>
        <option value="Africa/Lagos">UTC+1 — Lagos (Nigeria)</option>
        <option value="Africa/Luanda">UTC+1 — Luanda (Angola)</option>
        <option value="Africa/Lusaka">UTC+2 — Lusaka (Zambia)</option>
        <option value="Africa/Maputo">UTC+2 — Maputo (Mozambique)</option>
        <option value="Africa/Nairobi">UTC+3 — Nairobi (Kenya)</option>
        <option value="Africa/Tripoli">UTC+2 — Tripoli (Libya)</option>
        <option value="Africa/Tunis">UTC+1 — Tunis (Tunisia)</option>
      </optgroup>

      {/* ── Americas ── */}
      <optgroup label="Americas">
        <option value="America/Anchorage">UTC-9 — Anchorage (USA — Alaska)</option>
        <option value="America/Argentina/Buenos_Aires">UTC-3 — Buenos Aires (Argentina)</option>
        <option value="America/Asuncion">UTC-4 — Asunción (Paraguay)</option>
        <option value="America/Bogota">UTC-5 — Bogotá (Colombia)</option>
        <option value="America/Caracas">UTC-4 — Caracas (Venezuela)</option>
        <option value="America/Chicago">UTC-6 — Chicago / Central Time (USA)</option>
        <option value="America/Costa_Rica">UTC-6 — San José (Costa Rica)</option>
        <option value="America/Denver">UTC-7 — Denver / Mountain Time (USA)</option>
        <option value="America/Edmonton">UTC-7 — Edmonton (Canada — Alberta)</option>
        <option value="America/Fortaleza">UTC-3 — Fortaleza (Brazil — Northeast)</option>
        <option value="America/Godthab">UTC-3 — Nuuk (Greenland)</option>
        <option value="America/Guatemala">UTC-6 — Guatemala City (Guatemala)</option>
        <option value="America/Guayaquil">UTC-5 — Guayaquil (Ecuador)</option>
        <option value="America/Guyana">UTC-4 — Georgetown (Guyana)</option>
        <option value="America/Halifax">UTC-4 — Halifax (Canada — Atlantic)</option>
        <option value="America/Havana">UTC-5 — Havana (Cuba)</option>
        <option value="America/Jamaica">UTC-5 — Kingston (Jamaica)</option>
        <option value="America/La_Paz">UTC-4 — La Paz (Bolivia)</option>
        <option value="America/Lima">UTC-5 — Lima (Peru)</option>
        <option value="America/Los_Angeles">UTC-8 — Los Angeles / Pacific Time (USA)</option>
        <option value="America/Managua">UTC-6 — Managua (Nicaragua)</option>
        <option value="America/Manaus">UTC-4 — Manaus (Brazil — Amazonas)</option>
        <option value="America/Mazatlan">UTC-7 — Mazatlán (Mexico — Pacific)</option>
        <option value="America/Mexico_City">UTC-6 — Mexico City (Mexico)</option>
        <option value="America/Montevideo">UTC-3 — Montevideo (Uruguay)</option>
        <option value="America/New_York">UTC-5 — New York / Eastern Time (USA)</option>
        <option value="America/Noronha">UTC-2 — Fernando de Noronha (Brazil)</option>
        <option value="America/Panama">UTC-5 — Panama City (Panama)</option>
        <option value="America/Phoenix">UTC-7 — Phoenix (USA — Arizona, no DST)</option>
        <option value="America/Port-au-Prince">UTC-5 — Port-au-Prince (Haiti)</option>
        <option value="America/Port_of_Spain">UTC-4 — Port of Spain (Trinidad)</option>
        <option value="America/Puerto_Rico">UTC-4 — San Juan (Puerto Rico)</option>
        <option value="America/Regina">UTC-6 — Regina (Canada — Saskatchewan, no DST)</option>
        <option value="America/Santiago">UTC-4 — Santiago (Chile)</option>
        <option value="America/Santo_Domingo">UTC-4 — Santo Domingo (Dominican Republic)</option>
        <option value="America/Sao_Paulo">UTC-3 — São Paulo (Brazil)</option>
        <option value="America/St_Johns">UTC-3:30 — St. John's (Canada — Newfoundland)</option>
        <option value="America/Tegucigalpa">UTC-6 — Tegucigalpa (Honduras)</option>
        <option value="America/Toronto">UTC-5 — Toronto (Canada — Ontario)</option>
        <option value="America/Vancouver">UTC-8 — Vancouver (Canada — BC)</option>
        <option value="America/Winnipeg">UTC-6 — Winnipeg (Canada — Manitoba)</option>
      </optgroup>

      {/* ── Antarctica ── */}
      <optgroup label="Antarctica">
        <option value="Antarctica/McMurdo">UTC+13 — McMurdo (Antarctica)</option>
      </optgroup>

      {/* ── Arctic ── */}
      <optgroup label="Arctic">
        <option value="Arctic/Longyearbyen">UTC+1 — Longyearbyen (Svalbard)</option>
      </optgroup>

      {/* ── Asia ── */}
      <optgroup label="Asia">
        <option value="Asia/Almaty">UTC+6 — Almaty (Kazakhstan)</option>
        <option value="Asia/Amman">UTC+2 — Amman (Jordan)</option>
        <option value="Asia/Baghdad">UTC+3 — Baghdad (Iraq)</option>
        <option value="Asia/Baku">UTC+4 — Baku (Azerbaijan)</option>
        <option value="Asia/Bangkok">UTC+7 — Bangkok (Thailand)</option>
        <option value="Asia/Beirut">UTC+2 — Beirut (Lebanon)</option>
        <option value="Asia/Colombo">UTC+5:30 — Colombo (Sri Lanka)</option>
        <option value="Asia/Damascus">UTC+2 — Damascus (Syria)</option>
        <option value="Asia/Dhaka">UTC+6 — Dhaka (Bangladesh)</option>
        <option value="Asia/Dubai">UTC+4 — Dubai (UAE)</option>
        <option value="Asia/Dushanbe">UTC+5 — Dushanbe (Tajikistan)</option>
        <option value="Asia/Gaza">UTC+2 — Gaza (Palestinian Territory)</option>
        <option value="Asia/Hong_Kong">UTC+8 — Hong Kong</option>
        <option value="Asia/Irkutsk">UTC+8 — Irkutsk (Russia)</option>
        <option value="Asia/Jakarta">UTC+7 — Jakarta (Indonesia — WIB)</option>
        <option value="Asia/Jerusalem">UTC+2 — Jerusalem (Israel)</option>
        <option value="Asia/Kabul">UTC+4:30 — Kabul (Afghanistan)</option>
        <option value="Asia/Kamchatka">UTC+12 — Kamchatka (Russia)</option>
        <option value="Asia/Karachi">UTC+5 — Karachi (Pakistan)</option>
        <option value="Asia/Kathmandu">UTC+5:45 — Kathmandu (Nepal)</option>
        <option value="Asia/Kolkata">UTC+5:30 — Mumbai / Delhi (India)</option>
        <option value="Asia/Krasnoyarsk">UTC+7 — Krasnoyarsk (Russia)</option>
        <option value="Asia/Kuala_Lumpur">UTC+8 — Kuala Lumpur (Malaysia)</option>
        <option value="Asia/Kuwait">UTC+3 — Kuwait City (Kuwait)</option>
        <option value="Asia/Macau">UTC+8 — Macau (China SAR)</option>
        <option value="Asia/Magadan">UTC+11 — Magadan (Russia)</option>
        <option value="Asia/Makassar">UTC+8 — Makassar (Indonesia — WITA)</option>
        <option value="Asia/Manila">UTC+8 — Manila (Philippines)</option>
        <option value="Asia/Muscat">UTC+4 — Muscat (Oman)</option>
        <option value="Asia/Nicosia">UTC+2 — Nicosia (Cyprus)</option>
        <option value="Asia/Novosibirsk">UTC+7 — Novosibirsk (Russia)</option>
        <option value="Asia/Omsk">UTC+6 — Omsk (Russia)</option>
        <option value="Asia/Phnom_Penh">UTC+7 — Phnom Penh (Cambodia)</option>
        <option value="Asia/Pyongyang">UTC+9 — Pyongyang (North Korea)</option>
        <option value="Asia/Qatar">UTC+3 — Doha (Qatar)</option>
        <option value="Asia/Rangoon">UTC+6:30 — Yangon (Myanmar)</option>
        <option value="Asia/Riyadh">UTC+3 — Riyadh (Saudi Arabia)</option>
        <option value="Asia/Seoul">UTC+9 — Seoul (South Korea)</option>
        <option value="Asia/Shanghai">UTC+8 — Shanghai / Beijing (China)</option>
        <option value="Asia/Singapore">UTC+8 — Singapore</option>
        <option value="Asia/Taipei">UTC+8 — Taipei (Taiwan)</option>
        <option value="Asia/Tashkent">UTC+5 — Tashkent (Uzbekistan)</option>
        <option value="Asia/Tbilisi">UTC+4 — Tbilisi (Georgia)</option>
        <option value="Asia/Tehran">UTC+3:30 — Tehran (Iran)</option>
        <option value="Asia/Thimphu">UTC+6 — Thimphu (Bhutan)</option>
        <option value="Asia/Tokyo">UTC+9 — Tokyo (Japan)</option>
        <option value="Asia/Ulaanbaatar">UTC+8 — Ulaanbaatar (Mongolia)</option>
        <option value="Asia/Vladivostok">UTC+10 — Vladivostok (Russia)</option>
        <option value="Asia/Yakutsk">UTC+9 — Yakutsk (Russia)</option>
        <option value="Asia/Yekaterinburg">UTC+5 — Yekaterinburg (Russia)</option>
        <option value="Asia/Yerevan">UTC+4 — Yerevan (Armenia)</option>
      </optgroup>

      {/* ── Atlantic ── */}
      <optgroup label="Atlantic">
        <option value="Atlantic/Azores">UTC-1 — Azores (Portugal)</option>
        <option value="Atlantic/Cape_Verde">UTC-1 — Praia (Cape Verde)</option>
        <option value="Atlantic/Reykjavik">UTC+0 — Reykjavik (Iceland)</option>
        <option value="Atlantic/South_Georgia">UTC-2 — South Georgia</option>
        <option value="Atlantic/Stanley">UTC-3 — Stanley (Falkland Islands)</option>
      </optgroup>

      {/* ── Australia ── */}
      <optgroup label="Australia">
        <option value="Australia/Adelaide">UTC+9:30 — Adelaide (South Australia)</option>
        <option value="Australia/Brisbane">UTC+10 — Brisbane (Queensland, no DST)</option>
        <option value="Australia/Darwin">UTC+9:30 — Darwin (Northern Territory, no DST)</option>
        <option value="Australia/Hobart">UTC+10 — Hobart (Tasmania)</option>
        <option value="Australia/Melbourne">UTC+10 — Melbourne (Victoria)</option>
        <option value="Australia/Perth">UTC+8 — Perth (Western Australia)</option>
        <option value="Australia/Sydney">UTC+10 — Sydney (New South Wales)</option>
      </optgroup>

      {/* ── Europe ── */}
      <optgroup label="Europe">
        <option value="Europe/Amsterdam">UTC+1 — Amsterdam (Netherlands)</option>
        <option value="Europe/Athens">UTC+2 — Athens (Greece)</option>
        <option value="Europe/Belgrade">UTC+1 — Belgrade (Serbia)</option>
        <option value="Europe/Berlin">UTC+1 — Berlin (Germany)</option>
        <option value="Europe/Brussels">UTC+1 — Brussels (Belgium)</option>
        <option value="Europe/Bucharest">UTC+2 — Bucharest (Romania)</option>
        <option value="Europe/Budapest">UTC+1 — Budapest (Hungary)</option>
        <option value="Europe/Copenhagen">UTC+1 — Copenhagen (Denmark)</option>
        <option value="Europe/Dublin">UTC+0 — Dublin (Ireland)</option>
        <option value="Europe/Helsinki">UTC+2 — Helsinki (Finland)</option>
        <option value="Europe/Istanbul">UTC+3 — Istanbul (Turkey)</option>
        <option value="Europe/Kiev">UTC+2 — Kyiv (Ukraine)</option>
        <option value="Europe/Lisbon">UTC+0 — Lisbon (Portugal)</option>
        <option value="Europe/Ljubljana">UTC+1 — Ljubljana (Slovenia)</option>
        <option value="Europe/London">UTC+0 — London (United Kingdom)</option>
        <option value="Europe/Luxembourg">UTC+1 — Luxembourg</option>
        <option value="Europe/Madrid">UTC+1 — Madrid (Spain)</option>
        <option value="Europe/Malta">UTC+1 — Valletta (Malta)</option>
        <option value="Europe/Minsk">UTC+3 — Minsk (Belarus)</option>
        <option value="Europe/Moscow">UTC+3 — Moscow (Russia)</option>
        <option value="Europe/Nicosia">UTC+2 — Nicosia (Cyprus)</option>
        <option value="Europe/Oslo">UTC+1 — Oslo (Norway)</option>
        <option value="Europe/Paris">UTC+1 — Paris (France)</option>
        <option value="Europe/Prague">UTC+1 — Prague (Czech Republic)</option>
        <option value="Europe/Riga">UTC+2 — Riga (Latvia)</option>
        <option value="Europe/Rome">UTC+1 — Rome (Italy)</option>
        <option value="Europe/Samara">UTC+4 — Samara (Russia)</option>
        <option value="Europe/Sarajevo">UTC+1 — Sarajevo (Bosnia)</option>
        <option value="Europe/Skopje">UTC+1 — Skopje (North Macedonia)</option>
        <option value="Europe/Sofia">UTC+2 — Sofia (Bulgaria)</option>
        <option value="Europe/Stockholm">UTC+1 — Stockholm (Sweden)</option>
        <option value="Europe/Tallinn">UTC+2 — Tallinn (Estonia)</option>
        <option value="Europe/Tirane">UTC+1 — Tirana (Albania)</option>
        <option value="Europe/Ulyanovsk">UTC+4 — Ulyanovsk (Russia)</option>
        <option value="Europe/Vienna">UTC+1 — Vienna (Austria)</option>
        <option value="Europe/Vilnius">UTC+2 — Vilnius (Lithuania)</option>
        <option value="Europe/Warsaw">UTC+1 — Warsaw (Poland)</option>
        <option value="Europe/Zagreb">UTC+1 — Zagreb (Croatia)</option>
        <option value="Europe/Zurich">UTC+1 — Zurich (Switzerland)</option>
      </optgroup>

      {/* ── Indian Ocean ── */}
      <optgroup label="Indian Ocean">
        <option value="Indian/Maldives">UTC+5 — Malé (Maldives)</option>
        <option value="Indian/Mauritius">UTC+4 — Port Louis (Mauritius)</option>
        <option value="Indian/Reunion">UTC+4 — Saint-Denis (Réunion)</option>
      </optgroup>

      {/* ── Pacific ── */}
      <optgroup label="Pacific">
        <option value="Pacific/Apia">UTC+13 — Apia (Samoa)</option>
        <option value="Pacific/Auckland">UTC+12 — Auckland (New Zealand)</option>
        <option value="Pacific/Chatham">UTC+12:45 — Chatham Islands (NZ)</option>
        <option value="Pacific/Easter">UTC-6 — Easter Island (Chile)</option>
        <option value="Pacific/Fakaofo">UTC+13 — Fakaofo (Tokelau)</option>
        <option value="Pacific/Fiji">UTC+12 — Suva (Fiji)</option>
        <option value="Pacific/Gambier">UTC-9 — Gambier Islands (French Polynesia)</option>
        <option value="Pacific/Guadalcanal">UTC+11 — Honiara (Solomon Islands)</option>
        <option value="Pacific/Guam">UTC+10 — Hagåtña (Guam)</option>
        <option value="Pacific/Honolulu">UTC-10 — Honolulu (USA — Hawaii)</option>
        <option value="Pacific/Kiritimati">UTC+14 — Kiritimati (Kiribati)</option>
        <option value="Pacific/Majuro">UTC+12 — Majuro (Marshall Islands)</option>
        <option value="Pacific/Marquesas">UTC-9:30 — Marquesas Islands (French Polynesia)</option>
        <option value="Pacific/Nauru">UTC+12 — Yaren (Nauru)</option>
        <option value="Pacific/Niue">UTC-11 — Alofi (Niue)</option>
        <option value="Pacific/Norfolk">UTC+11 — Kingston (Norfolk Island)</option>
        <option value="Pacific/Noumea">UTC+11 — Nouméa (New Caledonia)</option>
        <option value="Pacific/Pago_Pago">UTC-11 — Pago Pago (American Samoa)</option>
        <option value="Pacific/Palau">UTC+9 — Ngerulmud (Palau)</option>
        <option value="Pacific/Pitcairn">UTC-8 — Adamstown (Pitcairn Islands)</option>
        <option value="Pacific/Port_Moresby">UTC+10 — Port Moresby (Papua New Guinea)</option>
        <option value="Pacific/Rarotonga">UTC-10 — Avarua (Cook Islands)</option>
        <option value="Pacific/Tahiti">UTC-10 — Papeete (French Polynesia)</option>
        <option value="Pacific/Tarawa">UTC+12 — South Tarawa (Kiribati)</option>
        <option value="Pacific/Tongatapu">UTC+13 — Nukuʻalofa (Tonga)</option>
        <option value="Pacific/Wake">UTC+12 — Wake Island (USA)</option>
        <option value="Pacific/Wallis">UTC+12 — Mata-Utu (Wallis &amp; Futuna)</option>
      </optgroup>

      {/* ── UTC ── */}
      <optgroup label="UTC">
        <option value="UTC">UTC+0 — Universal Coordinated Time</option>
      </optgroup>
    </select>
  )
}
