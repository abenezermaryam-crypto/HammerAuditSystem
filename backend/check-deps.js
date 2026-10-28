try {
  require('express-rate-limit');
  require('xss');
  require('nodemailer');
  require('bcryptjs');
  require('jsonwebtoken');
  require('mysql2');
  require('helmet');
  require('morgan');
  require('cors');
  console.log('ALL_DEPS_OK');
} catch(e) {
  console.error('MISSING:', e.message);
  process.exit(1);
}
