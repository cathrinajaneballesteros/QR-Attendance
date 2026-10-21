import Swal from 'sweetalert2';

// Custom SweetAlert2 theme matching Sta. Rosa Elementary School aesthetic
const SresSwal = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    popup: 'sres-swal-popup',
    title: 'sres-swal-title',
    htmlContainer: 'sres-swal-html',
    confirmButton: 'btn btn-primary sres-swal-confirm',
    cancelButton: 'btn btn-secondary sres-swal-cancel',
    actions: 'sres-swal-actions'
  }
});

/**
 * Modern replacement for window.confirm()
 * @param {Object} options
 * @param {string} options.title - Dialog title
 * @param {string} options.text - Dialog description
 * @param {string} [options.confirmButtonText='Yes, Continue']
 * @param {string} [options.cancelButtonText='Cancel']
 * @param {boolean} [options.isDanger=false] - If true, uses red danger styling for confirm button
 * @param {string} [options.icon='warning'] - 'warning' | 'info' | 'question' | 'error' | 'success'
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
 */
export async function showConfirm({
  title = 'Are you sure?',
  text = '',
  confirmButtonText = 'Yes, Continue',
  cancelButtonText = 'Cancel',
  isDanger = false,
  icon = 'warning'
}) {
  const result = await SresSwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: isDanger,
    customClass: {
      popup: 'sres-swal-popup',
      title: 'sres-swal-title',
      htmlContainer: 'sres-swal-html',
      confirmButton: isDanger ? 'btn btn-danger sres-swal-confirm' : 'btn btn-primary sres-swal-confirm',
      cancelButton: 'btn btn-secondary sres-swal-cancel',
      actions: 'sres-swal-actions'
    }
  });

  return result.isConfirmed;
}

/**
 * Modern replacement for window.alert()
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.text
 * @param {string} [options.icon='info']
 * @param {string} [options.confirmButtonText='OK']
 * @returns {Promise<void>}
 */
export async function showAlert({
  title = 'Notice',
  text = '',
  icon = 'info',
  confirmButtonText = 'OK'
}) {
  await SresSwal.fire({
    title,
    text,
    icon,
    confirmButtonText,
    customClass: {
      popup: 'sres-swal-popup',
      title: 'sres-swal-title',
      htmlContainer: 'sres-swal-html',
      confirmButton: 'btn btn-primary sres-swal-confirm',
      actions: 'sres-swal-actions'
    }
  });
}

/**
 * Toast notifications for non-blocking feedback
 */
export const showToast = (message, icon = 'success') => {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true
  });
};

export default {
  showConfirm,
  showAlert,
  showToast
};
