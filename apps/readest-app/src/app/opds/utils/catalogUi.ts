type TranslationFunc = (key: string, options?: Record<string, string | number>) => string;

export const getCatalogUiLabel = (_: TranslationFunc, isOnlineCatalogsAccessible?: boolean) =>
  isOnlineCatalogsAccessible ? _('Online Library') : _('OPDS / Calibre Catalogs');

export const getCatalogUiDescription = (
  _: TranslationFunc,
  isOnlineCatalogsAccessible?: boolean,
) =>
  isOnlineCatalogsAccessible
    ? _('Browse and download books from online catalogs.')
    : _(
        'Browse and download books from OPDS feeds, including Calibre Content Server and Calibre-Web libraries.',
      );

export const getCatalogSetupHint = (_: TranslationFunc, isOnlineCatalogsAccessible?: boolean) =>
  isOnlineCatalogsAccessible
    ? _(
        'Add a catalog URL. Readest will validate the feed and follow its browse, search, and download links.',
      )
    : _(
        'For Calibre Content Server, add the root catalog URL such as http://host:8080/opds or /opds/index.xml. Readest will follow OPDS browse, search, pagination, and download links automatically. If the server uses HTTP Basic Auth, enter the username and password below.',
      );
