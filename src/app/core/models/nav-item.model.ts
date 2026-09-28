export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Actif seulement sur son URL exacte (un autre menu est rangé sous la sienne). */
  exact: boolean;
}
