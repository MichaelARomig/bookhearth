__license__ = 'AGPL v3'
__copyright__ = '2026, Bilingify LLC'

from calibre.utils.config import JSONConfig
from qt.core import QCheckBox, QLabel, QLineEdit, QVBoxLayout, QWidget

from calibre_plugins.readest.api import DEFAULT_ANON_KEY, DEFAULT_API_BASE, DEFAULT_SUPABASE_URL

prefs = JSONConfig('plugins/readest')

prefs.defaults['api_base'] = DEFAULT_API_BASE
prefs.defaults['supabase_url'] = DEFAULT_SUPABASE_URL
prefs.defaults['anon_key'] = DEFAULT_ANON_KEY
prefs.defaults['tokens'] = None  # {access_token, refresh_token, expires_at, expires_in}
prefs.defaults['user_email'] = None
prefs.defaults['include_custom_columns'] = True


def save_tokens(tokens):
    prefs['tokens'] = tokens
    if tokens is None:
        prefs['user_email'] = None


class ConfigWidget(QWidget):
    def __init__(self):
        QWidget.__init__(self)
        layout = QVBoxLayout()
        self.setLayout(layout)

        account = prefs['user_email']
        status = ('Logged in as %s.' % account) if account else 'Not logged in.'
        status_label = QLabel(
            status
            + ' Configure a Readest-compatible server here, then use the Readest toolbar menu to log in or out.'
        )
        status_label.setWordWrap(True)
        layout.addWidget(status_label)

        self.custom_columns_checkbox = QCheckBox('Include custom columns in pushed metadata')
        self.custom_columns_checkbox.setChecked(bool(prefs['include_custom_columns']))
        layout.addWidget(self.custom_columns_checkbox)

        hint_label = QLabel(
            'This plugin no longer ships with built-in official Readest cloud endpoints. '
            'Enter the API server, auth server, and public anon key for your deployment.'
        )
        hint_label.setWordWrap(True)
        layout.addWidget(hint_label)

        layout.addWidget(QLabel('API server:'))
        self.api_base_edit = QLineEdit(self)
        self.api_base_edit.setText(prefs['api_base'])
        self.api_base_edit.setToolTip(
            'Base URL for the Readest-compatible sync/storage API, for example https://reader.example.com/api'
        )
        layout.addWidget(self.api_base_edit)

        layout.addWidget(QLabel('Auth server:'))
        self.supabase_url_edit = QLineEdit(self)
        self.supabase_url_edit.setText(prefs['supabase_url'])
        self.supabase_url_edit.setToolTip(
            'Base URL for the Supabase-compatible auth server, for example https://auth.example.com'
        )
        layout.addWidget(self.supabase_url_edit)

        layout.addWidget(QLabel('Public anon key:'))
        self.anon_key_edit = QLineEdit(self)
        self.anon_key_edit.setText(prefs['anon_key'])
        self.anon_key_edit.setToolTip(
            'Public anon key for the configured auth server. This is not your password.'
        )
        layout.addWidget(self.anon_key_edit)

        layout.addStretch()

    def save_settings(self):
        api_base = self.api_base_edit.text().strip().rstrip('/')
        supabase_url = self.supabase_url_edit.text().strip().rstrip('/')
        anon_key = self.anon_key_edit.text().strip()
        if (
            api_base != prefs['api_base']
            or supabase_url != prefs['supabase_url']
            or anon_key != prefs['anon_key']
        ):
            save_tokens(None)
        prefs['include_custom_columns'] = self.custom_columns_checkbox.isChecked()
        prefs['api_base'] = api_base or DEFAULT_API_BASE
        prefs['supabase_url'] = supabase_url or DEFAULT_SUPABASE_URL
        prefs['anon_key'] = anon_key or DEFAULT_ANON_KEY
