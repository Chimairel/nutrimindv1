const phpCurrency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const mediumPhilippineDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' });
const philippineDateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'long',
  timeStyle: 'short',
});

export const formatPhpMinor = (minor: number) => phpCurrency.format(minor / 100);

export const formatPhilippineDate = (value: string | Date) => mediumPhilippineDate.format(new Date(value));

export const formatPhilippineDateTime = (value: string | Date) => philippineDateTime.format(new Date(value));
